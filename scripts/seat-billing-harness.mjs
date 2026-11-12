import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migration = (file) => readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/canvas-migrations', file), 'utf8');

const BEFORE_SEATS = ['20260924_credit_balance_service_role.sql', '20260929_feega_plan_grants.sql', '20261112_credits_never_expire.sql'];
const GRANDFATHER = '20261113_editor_seats_grandfathered.sql';
const AFTER_GRANDFATHER = ['20261113_seat_proration_grants.sql', '20261113_viewers_after_cancel.sql'];

const PAID = '11111111-1111-4111-8111-111111111111';
const CROWDED_FREE = '22222222-2222-4222-8222-222222222222';
const SOLO_FREE = '33333333-3333-4333-8333-333333333333';
const LEGACY = '44444444-4444-4444-8444-444444444444';
const SEAT_PRICE = 'price_9';
const LEGACY_PRICE = 'price_8';

const STUBS = `
  create schema auth;
  create function auth.role() returns text language sql as $$ select 'service_role' $$;
  create function public.auth_org_ids() returns setof uuid language sql as $$ select null::uuid where false $$;
  create role anon; create role authenticated; create role service_role;
  create table public.orgs (id uuid primary key, stripe_subscription_id text);
  create table public.orgs_members (org_id uuid not null, user_id text not null, role text not null, primary key (org_id, user_id));
  create table public.credit_ledger (
    id bigserial primary key, org_id uuid not null, kind text not null, source text not null,
    amount integer not null check (amount > 0), expires_at timestamptz,
    stripe_event_id text unique, stripe_invoice_id text, stripe_checkout_id text
  );
  create schema stripe;
  create table stripe.prices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.subscriptions (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.invoices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.checkout_sessions (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
`;

const meta = (org) => ({ app: 'feega', org_id: org, credits: '500' });

const line = (amount, quantity, price = SEAT_PRICE) => ({ amount, quantity, proration: true, pricing: { price_details: { price } } });

const seatChange = (id, lines) => ({
  id,
  status: 'paid',
  billing_reason: 'subscription_update',
  parent: { subscription_details: { metadata: meta(PAID) } },
  lines: { data: lines }
});

const db = new PGlite();
await db.exec(STUBS);
for (const file of BEFORE_SEATS) {
  await db.exec(migration(file));
}

await db.query(`insert into stripe.prices (_raw_data) values ($1), ($2)`, [
  { id: SEAT_PRICE, currency: 'eur', unit_amount: 900, metadata: { app: 'feega', credits: '500' } },
  { id: LEGACY_PRICE, currency: 'eur', unit_amount: 800, metadata: { app: 'feega', credits: '800' } }
]);
await db.query(`insert into orgs (id, stripe_subscription_id) values ($1, 'sub_paid'), ($2, null), ($3, null), ($4, 'sub_legacy')`, [PAID, CROWDED_FREE, SOLO_FREE, LEGACY]);
await db.query(
  `insert into orgs_members (org_id, user_id, role) values
    ($1, 'p-owner', 'owner'), ($1, 'p-admin', 'admin'), ($1, 'p-member', 'member'), ($1, 'p-viewer', 'viewer'),
    ($2, 'c-owner', 'owner'), ($2, 'c-member', 'member'), ($2, 'c-member-2', 'member'),
    ($3, 's-owner', 'owner'), ($3, 's-viewer', 'viewer')`,
  [PAID, CROWDED_FREE, SOLO_FREE]
);

await db.exec(migration(GRANDFATHER));
for (const file of AFTER_GRANDFATHER) {
  await db.exec(migration(file));
}

let failures = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
  failures += ok ? 0 : 1;
};

async function inTransaction(work) {
  await db.query('begin');
  try {
    return await work();
  } finally {
    await db.query('rollback');
  }
}

const grantsOf = async (org) =>
  (await db.query(`select source, amount from credit_ledger where org_id = $1 order by id`, [org])).rows;

const roles = async (org) =>
  Object.fromEntries((await db.query('select user_id, role from orgs_members where org_id = $1', [org])).rows.map((r) => [r.user_id, r.role]));

const flagged = async (org) => (await db.query('select editor_seats_grandfathered_at is not null as on from orgs where id = $1', [org])).rows[0].on;

report(await flagged(CROWDED_FREE), 'a free team with three editors today is grandfathered, as a fact in data');
report(!(await flagged(SOLO_FREE)), 'a free team with one editor is not grandfathered');
report(!(await flagged(PAID)), 'a paying team is not grandfathered');

const added = await inTransaction(async () => {
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [seatChange('in_add', [line(-900, 2), line(1350, 3)])]);
  return grantsOf(PAID);
});
report(
  JSON.stringify(added) === JSON.stringify([{ source: 'subscription_renewal', amount: 250 }]),
  `one seat added half way through the period grants 500 × 1/2 = 250: got ${JSON.stringify(added)}`
);

const removed = await inTransaction(async () => {
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [seatChange('in_remove', [line(-1350, 3), line(900, 2)])]);
  return grantsOf(PAID);
});
report(removed.length === 0, `a removed seat writes no ledger row: got ${JSON.stringify(removed)}`);

const addThenRemove = await inTransaction(async () => {
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [seatChange('in_add_2', [line(-900, 2), line(1350, 3)])]);
  await db.query('update stripe.invoices set _raw_data = _raw_data where id = $1', ['in_add_2']);
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [seatChange('in_remove_2', [line(-1350, 3), line(900, 2)])]);
  return grantsOf(PAID);
});
report(
  JSON.stringify(addThenRemove) === JSON.stringify([{ source: 'subscription_renewal', amount: 250 }]),
  `a seat added then removed in the same period grants once and claws nothing back: got ${JSON.stringify(addThenRemove)}`
);

const legacy = await inTransaction(async () => {
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [
    {
      id: 'in_legacy',
      status: 'paid',
      billing_reason: 'subscription_cycle',
      parent: { subscription_details: { metadata: { app: 'feega', org_id: LEGACY, credits: '800' } } },
      lines: { data: [{ quantity: 1, pricing: { price_details: { price: LEGACY_PRICE } }, period: { end: 1893456000 } }] }
    }
  ]);
  return grantsOf(LEGACY);
});
report(legacy[0]?.amount === 800, `the old feega_monthly_8 subscriber's renewal still grants 800: got ${JSON.stringify(legacy)}`);

const afterCancel = await inTransaction(async () => {
  await db.query('insert into stripe.subscriptions (_raw_data) values ($1)', [{ id: 'sub_paid', status: 'active', metadata: meta(PAID) }]);
  await db.query(`update stripe.subscriptions set _raw_data = jsonb_set(_raw_data, '{status}', '"canceled"') where id = 'sub_paid'`);
  return roles(PAID);
});
report(
  afterCancel['p-owner'] === 'owner' && afterCancel['p-admin'] === 'viewer' && afterCancel['p-member'] === 'viewer' && afterCancel['p-viewer'] === 'viewer',
  `when a paid team ends, every editor but the owner becomes a viewer: got ${JSON.stringify(afterCancel)}`
);

const grandfatherPays = await inTransaction(async () => {
  await db.query('insert into stripe.subscriptions (_raw_data) values ($1)', [{ id: 'sub_crowded', status: 'active', metadata: meta(CROWDED_FREE) }]);
  const flagWhilePaying = await flagged(CROWDED_FREE);
  await db.query(`update stripe.subscriptions set _raw_data = jsonb_set(_raw_data, '{status}', '"canceled"') where id = 'sub_crowded'`);
  return { flagWhilePaying, roles: await roles(CROWDED_FREE) };
});
report(
  !grandfatherPays.flagWhilePaying && grandfatherPays.roles['c-member'] === 'viewer',
  `a grandfathered team that pays loses the flag, and cancelling then demotes like any team: got ${JSON.stringify(grandfatherPays)}`
);

process.exit(failures ? 1 : 0);
