import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const MIGRATION = join(
  fileURLToPath(new URL('..', import.meta.url)),
  'supabase/canvas-migrations/20260929_feega_plan_grants.sql'
);

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';

const LIVE_SHAPED_STUBS = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;

  create table public.orgs (id uuid primary key, stripe_customer_id text, stripe_subscription_id text);
  create table public.credit_ledger (
    id bigserial primary key,
    org_id uuid not null references public.orgs(id),
    kind text not null, source text not null, amount integer not null check (amount > 0),
    stripe_event_id text unique, stripe_checkout_id text, stripe_invoice_id text, expires_at timestamptz
  );

  create schema stripe;
  create table stripe.prices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.subscriptions (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.invoices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.checkout_sessions (
    _raw_data jsonb,
    id text generated always as (_raw_data->>'id') stored primary key,
    mode text generated always as (_raw_data->>'mode') stored,
    metadata jsonb generated always as (_raw_data->'metadata') stored
  );
`;

const feegaMeta = (extra = {}) => ({ app: 'feega', org_id: ORG, ...extra });

const invoice = (id, overrides = {}) => ({
  id,
  status: 'paid',
  billing_reason: 'subscription_cycle',
  parent: { subscription_details: { metadata: feegaMeta({ credits: '800' }) } },
  lines: { data: [{ pricing: { price_details: { price: 'price_8' } }, period: { end: 1893456000 } }] },
  ...overrides
});

const checkout = (id, overrides = {}) => ({
  id,
  mode: 'payment',
  status: 'complete',
  payment_status: 'paid',
  metadata: feegaMeta({ credits: '1600' }),
  ...overrides
});

const SCENARIOS = [
  {
    name: 'a paid renewal falls back to the subscription credits when its price is not synced',
    rows: [['invoices', invoice('in_1')]],
    expect: [{ event: 'invoice:in_1', amount: 800 }]
  },
  {
    name: 'the price decides the credits, not stale subscription metadata after a plan change',
    rows: [
      ['prices', { id: 'price_32', metadata: { app: 'feega', credits: '3200' } }],
      [
        'invoices',
        invoice('in_2', {
          lines: { data: [{ pricing: { price_details: { price: 'price_32' } }, period: { end: 1893456000 } }] }
        })
      ]
    ],
    expect: [{ event: 'invoice:in_2', amount: 3200 }]
  },
  {
    name: 'the first invoice of a subscription grants too',
    rows: [['invoices', invoice('in_3', { billing_reason: 'subscription_create' })]],
    expect: [{ event: 'invoice:in_3', amount: 800 }]
  },
  {
    name: 'the same invoice synced twice grants once',
    rows: [
      ['invoices', invoice('in_4')],
      ['invoices', invoice('in_4'), 'update']
    ],
    expect: [{ event: 'invoice:in_4', amount: 800 }]
  },
  {
    name: 'an unpaid or proration invoice grants nothing',
    rows: [
      ['invoices', invoice('in_5', { status: 'open' })],
      ['invoices', invoice('in_6', { billing_reason: 'subscription_update' })]
    ],
    expect: []
  },
  {
    name: 'another app on the shared account is ignored',
    rows: [
      ['invoices', invoice('in_7', { parent: { subscription_details: { metadata: { app: 'other', org_id: ORG, credits: '800' } } } })],
      ['invoices', invoice('in_8', { parent: { subscription_details: { metadata: { credits: '800' } } } })],
      ['checkout_sessions', checkout('cs_other', { metadata: { plan: 'pro' } })]
    ],
    expect: []
  },
  {
    name: 'an org id that is no org, or no uuid, is ignored without breaking the sync',
    rows: [
      ['invoices', invoice('in_9', { parent: { subscription_details: { metadata: feegaMeta({ org_id: OTHER_ORG_ID }) } } })],
      ['checkout_sessions', checkout('cs_bad', { metadata: feegaMeta({ org_id: 'not-a-uuid', credits: '1600' }) })]
    ],
    expect: []
  },
  {
    name: 'a paid one-time checkout grants once, reading status from the raw payload',
    rows: [
      ['checkout_sessions', checkout('cs_1')],
      ['checkout_sessions', checkout('cs_1'), 'update']
    ],
    expect: [{ event: 'checkout:cs_1', amount: 1600 }]
  },
  {
    name: 'an unpaid checkout grants nothing',
    rows: [['checkout_sessions', checkout('cs_2', { payment_status: 'unpaid' })]],
    expect: []
  }
];

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`DATABASE_URL must point at localhost, got ${host}`);
  }
}

async function write(client, [table, raw, op = 'insert']) {
  if (op === 'update') {
    await client.query(`update stripe.${table} set _raw_data = $1 where id = $2`, [raw, raw.id]);
    return;
  }
  await client.query(`insert into stripe.${table} (_raw_data) values ($1)`, [raw]);
}

async function runScenario(client, scenario) {
  await client.query('savepoint scenario');
  try {
    for (const row of scenario.rows) {
      await write(client, row);
    }
    const { rows } = await client.query('select stripe_event_id as event, amount from public.credit_ledger order by stripe_event_id');
    const got = JSON.stringify(rows);
    const want = JSON.stringify(scenario.expect);
    return got === want ? null : `got ${got}, want ${want}`;
  } finally {
    await client.query('rollback to savepoint scenario');
  }
}

async function subscriptionLink(client) {
  await client.query('savepoint link');
  try {
    const sub = { id: 'sub_1', status: 'active', metadata: feegaMeta() };
    await write(client, ['subscriptions', sub]);
    const linked = (await client.query('select stripe_subscription_id from public.orgs where id = $1', [ORG])).rows[0];
    await write(client, ['subscriptions', { ...sub, status: 'canceled' }, 'update']);
    const unlinked = (await client.query('select stripe_subscription_id from public.orgs where id = $1', [ORG])).rows[0];
    const ready = (await client.query('select public.billing_grants_ready() as ready')).rows[0].ready;
    if (linked.stripe_subscription_id !== 'sub_1') {
      return 'active subscription did not link the org';
    }
    if (unlinked.stripe_subscription_id !== null) {
      return 'canceled subscription stayed linked';
    }
    return ready === true ? null : 'billing_grants_ready() is not true with both triggers in place';
  } finally {
    await client.query('rollback to savepoint link');
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  assertLocal(url);

  const client = new Client({ connectionString: url });
  await client.connect();
  let failures = 0;
  try {
    await client.query('begin');
    await client.query(LIVE_SHAPED_STUBS);
    await client.query(readFileSync(MIGRATION, 'utf8').replace(/^begin;|commit;\s*$/gm, ''));
    await client.query('insert into public.orgs (id) values ($1)', [ORG]);

    const results = [];
    for (const scenario of SCENARIOS) {
      results.push([scenario.name, await runScenario(client, scenario)]);
    }
    results.push(['a subscription links and unlinks its org', await subscriptionLink(client)]);

    for (const [name, error] of results) {
      console.log(`${error ? 'FAIL' : 'ok  '} ${name}${error ? ` — ${error}` : ''}`);
      failures += error ? 1 : 0;
    }
  } finally {
    await client.query('rollback');
    await client.end();
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
