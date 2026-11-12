import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = join(
  fileURLToPath(new URL('..', import.meta.url)),
  'supabase/canvas-migrations/20260924_credit_balance_service_role.sql'
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
  create table public.credit_ledger (
    id bigserial primary key, org_id uuid not null, kind text not null, source text not null,
    amount integer not null check (amount > 0), expires_at timestamptz
  );
`;

const SCENARIOS = [
  { name: 'spent the whole grant, then the renewal lands', spent: 800 },
  { name: 'spent part of the grant, then the renewal lands', spent: 300 }
];

async function balanceAfterRenewal(db, spent) {
  await db.query('begin');
  await db.query(`insert into credit_ledger (org_id, kind, source, amount, expires_at) values ($1, 'grant', 'subscription_renewal', $2, ${LAST_MONTH})`, [ORG, MONTHLY_CREDITS]);
  await db.query(`insert into credit_ledger (org_id, kind, source, amount) values ($1, 'debit', 'ai_usage', $2)`, [ORG, spent]);
  await db.query(`insert into credit_ledger (org_id, kind, source, amount, expires_at) values ($1, 'grant', 'subscription_renewal', $2, ${NEXT_MONTH})`, [ORG, MONTHLY_CREDITS]);
  const { rows } = await db.query('select public.org_credit_balance($1) as balance', [ORG]);
  await db.query('rollback');
  return rows[0].balance;
}

const db = new PGlite();
await db.exec(STUBS);
await db.exec(readFileSync(MIGRATION, 'utf8'));

let failures = 0;
for (const { name, spent } of SCENARIOS) {
  const got = await balanceAfterRenewal(db, spent);
  const ok = got === MONTHLY_CREDITS;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: balance ${got}, want ${MONTHLY_CREDITS}`);
  failures += ok ? 0 : 1;
}
process.exit(failures ? 1 : 0);
