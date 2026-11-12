import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS = ['20260924_credit_balance_service_role.sql', '20260929_feega_plan_grants.sql', '20261112_credits_never_expire.sql', '20261113_seat_proration_grants.sql'].map((file) =>
  join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/canvas-migrations', file)
);
const ORG = '11111111-1111-4111-8111-111111111111';
const MONTHLY_CREDITS = 800;
const LAST_MONTH = "now() - interval '1 day'";
const NEXT_MONTH = "now() + interval '30 days'";

const STUBS = `
  create schema auth;
  create function auth.role() returns text language sql as $$ select 'service_role' $$;
  create function public.auth_org_ids() returns setof uuid language sql as $$ select null::uuid where false $$;
  create role anon; create role authenticated; create role service_role;
  create table public.orgs (id uuid primary key, stripe_subscription_id text);
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

const SCENARIOS = [
  { name: 'spent the whole grant, then the renewal lands', spent: 800, want: 800 },
  { name: 'spent part of the grant, then the renewal lands: the unspent part carries over', spent: 300, want: 1300 }
];

const RENEWAL = {
  id: 'in_renewal',
  status: 'paid',
  billing_reason: 'subscription_cycle',
  parent: { subscription_details: { metadata: { app: 'feega', org_id: ORG, credits: '500' } } },
  lines: { data: [{ period: { end: 1893456000 } }] }
};

async function balanceAfterRenewal(db, spent) {
  await db.query('begin');
  await db.query(`insert into credit_ledger (org_id, kind, source, amount, expires_at) values ($1, 'grant', 'subscription_renewal', $2, ${LAST_MONTH})`, [ORG, MONTHLY_CREDITS]);
  await db.query(`insert into credit_ledger (org_id, kind, source, amount) values ($1, 'debit', 'ai_usage', $2)`, [ORG, spent]);
  await db.query(`insert into credit_ledger (org_id, kind, source, amount, expires_at) values ($1, 'grant', 'subscription_renewal', $2, ${NEXT_MONTH})`, [ORG, MONTHLY_CREDITS]);
  const { rows } = await db.query('select public.org_credit_balance($1) as balance', [ORG]);
  await db.query('rollback');
  return rows[0].balance;
}

async function renewalGrant(db, invoice) {
  await db.query('begin');
  await db.query('insert into stripe.invoices (_raw_data) values ($1)', [invoice]);
  const { rows } = await db.query('select amount, expires_at from credit_ledger where stripe_invoice_id = $1', [invoice.id]);
  await db.query('rollback');
  return rows[0];
}

const db = new PGlite();
await db.exec(STUBS);
for (const migration of MIGRATIONS) {
  await db.exec(readFileSync(migration, 'utf8'));
}
await db.query('insert into public.orgs (id) values ($1)', [ORG]);

let failures = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
  failures += ok ? 0 : 1;
};

for (const { name, spent, want } of SCENARIOS) {
  const got = await balanceAfterRenewal(db, spent);
  report(got === want, `${name}: balance ${got}, want ${want}`);
}

const grant = await renewalGrant(db, RENEWAL);
report(grant?.amount === 500 && grant.expires_at === null, `a renewal grant never expires: got ${JSON.stringify(grant)}`);

const seats = await renewalGrant(db, { ...RENEWAL, id: 'in_seats', lines: { data: [{ quantity: 3, period: { end: 1893456000 } }] } });
report(seats?.amount === 1500, `three seats grant three times the credits: got ${JSON.stringify(seats)}`);

process.exit(failures ? 1 : 0);
