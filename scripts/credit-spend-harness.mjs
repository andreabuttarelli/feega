import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const MIGRATION = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/canvas-migrations/20261116_credit_spend_atomic.sql'), 'utf8');
const REAL_POSTGRES = process.env.CREDIT_SPEND_DATABASE_URL;
const PARALLEL = 12;

const STUBS = `
  create schema if not exists auth;
  create or replace function auth.role() returns text language sql as $$ select 'service_role' $$;
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  create table public.orgs (id uuid primary key);
  create table public.ai_calls (
    id uuid primary key default gen_random_uuid(), org_id uuid not null, operation text not null default 'op',
    billed_credits numeric, created_at timestamptz not null default now()
  );
  create table public.credit_ledger (
    id uuid primary key default gen_random_uuid(), org_id uuid not null, kind text not null, source text not null,
    amount integer not null check (amount > 0), note text, ai_call_id uuid references public.ai_calls(id) on delete set null,
    stripe_event_id text unique, expires_at timestamptz, created_at timestamptz not null default now()
  );
`;

let orgCount = 0;
const freshOrg = () => `00000000-0000-4000-8000-${String(++orgCount).padStart(12, '0')}`;

function connect() {
  if (!REAL_POSTGRES) {
    const db = new PGlite();
    return { exec: (sql) => db.exec(sql), query: (sql, params) => db.query(sql, params), end: () => db.close(), mode: 'pglite (serialised: proves the logic, not the lock)' };
  }
  const host = new URL(REAL_POSTGRES).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`the harness drops the public schema: it only runs against a local throwaway postgres, not ${host}`);
  }
  const pool = new pg.Pool({ connectionString: REAL_POSTGRES, max: PARALLEL + 2 });
  return { exec: (sql) => pool.query(sql), query: (sql, params) => pool.query(sql, params), end: () => pool.end(), mode: `postgres, ${PARALLEL} parallel connections` };
}

const db = connect();
await db.exec('drop schema if exists public cascade; create schema public;');
await db.exec(STUBS);
await db.exec(MIGRATION);

let failures = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
  failures += ok ? 0 : 1;
};

async function orgWith(credits) {
  const org = freshOrg();
  await db.query('insert into public.orgs (id) values ($1)', [org]);
  await db.query(`insert into public.credit_ledger (org_id, kind, source, amount) values ($1, 'grant', 'promo', $2)`, [org, credits]);
  return org;
}

const balance = async (org) => Number((await db.query('select public.credit_gate($1) as b', [org])).rows[0].b);
const hold = async (org, keys, amounts) => (await db.query('select public.credit_hold($1, $2::text[], $3::integer[]) as ok', [org, keys, amounts])).rows[0].ok;
const release = async (org, key) => Number((await db.query('select public.credit_release($1, $2) as back', [org, key])).rows[0].back);
const call = async (org, credits, holdKey = null, id = null) =>
  (await db.query('insert into public.ai_calls (id, org_id, billed_credits, hold_key) values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4) returning id', [id, org, credits, holdKey])).rows[0].id;
const rejected = (promise) => promise.then(() => false, () => true);

{
  const org = await orgWith(100);
  const outcomes = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => hold(org, [`race-${i}`], [30])));
  const held = outcomes.filter(Boolean).length;
  report(held === 3 && (await balance(org)) === 10, `${PARALLEL} parallel holds of 30 on 100 credits: ${held} held, balance ${await balance(org)} (want 3 and 10)`);
}

{
  const org = await orgWith(100);
  const first = await hold(org, ['retry'], [40]);
  const again = await hold(org, ['retry'], [40]);
  report(first && again && (await balance(org)) === 60, `a hold retried with the same key is taken once: balance ${await balance(org)} (want 60)`);
}

{
  const org = await orgWith(100);
  const ok = await hold(org, ['batch-1', 'batch-2'], [60, 60]);
  report(!ok && (await balance(org)) === 100, `a batch that does not fit holds nothing: balance ${await balance(org)} (want 100)`);
}

{
  const org = await orgWith(100);
  await hold(org, ['refund'], [50]);
  const back = await release(org, 'refund');
  const twice = await release(org, 'refund');
  report(back === 50 && twice === 50 && (await balance(org)) === 100, `a release refunds the hold once, however often it is called: balance ${await balance(org)} (want 100)`);
}

{
  const org = await orgWith(100);
  await call(org, 7);
  report((await balance(org)) === 93, `a billed ai_calls row debits in the same transaction: balance ${await balance(org)} (want 93)`);
}

{
  const org = await orgWith(100);
  const id = await call(org, 7);
  const duplicate = await rejected(call(org, 7, null, id));
  report(duplicate && (await balance(org)) === 93, `the same call written twice is charged once: balance ${await balance(org)} (want 93)`);
}

{
  const org = await orgWith(100);
  const id = await call(org, 7);
  const legacy = await rejected(db.query(`insert into public.credit_ledger (org_id, kind, source, amount, ai_call_id) values ($1, 'debit', 'ai_usage', 7, $2)`, [org, id]));
  report(legacy && (await balance(org)) === 93, `a second debit for the same call, as the code before this migration writes it, is refused: balance ${await balance(org)} (want 93)`);
}

{
  const org = await orgWith(100);
  await call(org, 0);
  await call(org, null);
  report((await balance(org)) === 100, `an unpriced or free call debits nothing: balance ${await balance(org)} (want 100)`);
}

{
  const org = await orgWith(100);
  await hold(org, ['render-a'], [50]);
  await call(org, 20, 'render-a');
  report((await balance(org)) === 80, `a call that settles its hold costs what it billed, not the hold: balance ${await balance(org)} (want 80)`);
}

{
  const org = await orgWith(100);
  await db.query(`insert into public.credit_ledger (org_id, kind, source, amount, note) values ($1, 'debit', 'ai_usage', 50, 'motion render hold legacy')`, [org]);
  const back = await release(org, 'motion render hold legacy');
  report(back === 50 && (await balance(org)) === 100, `a hold written before this migration (note only) is released by its key: balance ${await balance(org)} (want 100)`);
}

{
  const org = await orgWith(100);
  await db.query(`insert into public.credit_ledger (org_id, kind, source, amount, note) values ($1, 'debit', 'ai_usage', 50, 'motion render hold old-refunded'), ($1, 'grant', 'refund', 50, 'motion render hold old-refunded')`, [org]);
  const back = await release(org, 'motion render hold old-refunded');
  report(back === 50 && (await balance(org)) === 100, `a legacy hold already refunded is not refunded again: balance ${await balance(org)} (want 100)`);
}

{
  const org = await orgWith(300);
  await hold(org, ['stale'], [50]);
  await hold(org, ['fresh'], [50]);
  await hold(org, ['settled'], [50]);
  await call(org, 10, 'settled');
  await db.query(`update public.credit_ledger set created_at = now() - interval '2 days' where call_key in ('stale', 'settled')`);
  const released = Number((await db.query(`select public.credit_release_stale(interval '1 day') as n`)).rows[0].n);
  report(released === 1 && (await balance(org)) === 300 - 50 - 10, `the reconciler releases only an old hold nobody settled: ${released} released, balance ${await balance(org)} (want 1 and 240)`);
}

{
  const { rows } = await db.query(`
    select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as user_can, has_function_privilege('anon', p.oid, 'execute') as anon_can
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('credit_gate', 'credit_hold', 'credit_release', 'credit_release_stale')`);
  const open = rows.filter((r) => r.user_can || r.anon_can).map((r) => r.proname);
  report(rows.length === 4 && open.length === 0, `only the server can hold, release or read the gate: open to users ${JSON.stringify(open)}`);
}

console.log(`(${db.mode})`);
await db.end();
process.exit(failures ? 1 : 0);
