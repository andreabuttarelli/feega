import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migration = (file) => readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/canvas-migrations', file), 'utf8');

const BEFORE_SEATS = ['20260924_credit_balance_service_role.sql', '20260929_feega_plan_grants.sql', '20261112_credits_never_expire.sql'];
const SEATS = '20261113_editor_seats.sql';

const PAID = '11111111-1111-4111-8111-111111111111';
const CROWDED_FREE = '22222222-2222-4222-8222-222222222222';
const SOLO_FREE = '33333333-3333-4333-8333-333333333333';
const LEGACY = '44444444-4444-4444-8444-444444444444';
const SEAT_PRICE = 'price_9';
const LEGACY_PRICE = 'price_8';
const PERIOD_END = 1893456000;

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

const meta = (org, credits = '500') => ({ app: 'feega', org_id: org, credits });

const proration = (amount, quantity, price = SEAT_PRICE) => ({ amount, quantity, proration: true, pricing: { price_details: { price } } });
const seatLine = (quantity, price = SEAT_PRICE, amount = 900 * quantity) => ({ amount, quantity, pricing: { price_details: { price } }, period: { end: PERIOD_END } });

const invoice = (id, reason, lines, org = PAID, extra = {}) => ({
  id,
  status: 'paid',
  currency: 'eur',
  billing_reason: reason,
  parent: { subscription_details: { metadata: meta(org) } },
  lines: { data: lines },
  ...extra
});

const addSeat = (id, from, extra = {}) => invoice(id, 'subscription_update', [proration(-450 * from, from), proration(450 * (from + 1), from + 1)], PAID, extra);

let failures = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
  failures += ok ? 0 : 1;
};

async function world() {
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
  await db.exec(migration(SEATS));
  return db;
}

const put = (db, raw) => db.query('insert into stripe.invoices (_raw_data) values ($1)', [raw]);
const total = async (db, org = PAID) => (await db.query('select coalesce(sum(amount), 0)::int as sum, count(*)::int as n from credit_ledger where org_id = $1', [org])).rows[0];
const roles = async (db, org) => Object.fromEntries((await db.query('select user_id, role from orgs_members where org_id = $1', [org])).rows.map((r) => [r.user_id, r.role]));
const flagged = async (db, org) => (await db.query('select editor_seats_grandfathered_at is not null as on from orgs where id = $1', [org])).rows[0].on;
const subscribe = (db, id, org, status) => db.query('insert into stripe.subscriptions (_raw_data) values ($1)', [{ id, status, metadata: meta(org) }]);
const setStatus = (db, id, status) => db.query(`update stripe.subscriptions set _raw_data = jsonb_set(_raw_data, '{status}', to_jsonb($2::text)) where id = $1`, [id, status]);
const linked = async (db, org) => (await db.query('select stripe_subscription_id from orgs where id = $1', [org])).rows[0].stripe_subscription_id;

{
  const db = await world();
  report(await flagged(db, CROWDED_FREE), 'a free team with three editors today is grandfathered, as a fact in data');
  report(!(await flagged(db, SOLO_FREE)), 'a free team with one editor is not grandfathered');
  report(!(await flagged(db, PAID)), 'a paying team is not grandfathered');
}

{
  const db = await world();
  await put(db, invoice('in_create', 'subscription_create', [seatLine(1)]));
  await put(db, addSeat('in_add', 1));
  const got = await total(db);
  report(got.sum === 750 && got.n === 2, `one seat added half way through the period grants 250 on top of the 500: got ${JSON.stringify(got)}`);
}

{
  const db = await world();
  await put(db, invoice('in_create', 'subscription_create', [seatLine(1)]));
  for (let i = 0; i < 5; i++) {
    await put(db, addSeat(`in_add_${i}`, 1, { amount_paid: i === 0 ? 450 : 0 }));
    await put(db, invoice(`in_rm_${i}`, 'subscription_update', [proration(-900, 2), proration(450, 1)], PAID, { amount_paid: 0, total: -450 }));
  }
  const got = await total(db);
  report(got.sum === 750 && got.n === 2, `add, remove, add again five times in one period: one charge, one grant (500 + 250): got ${JSON.stringify(got)}`);
}

{
  const db = await world();
  await put(db, invoice('in_create', 'subscription_create', [seatLine(1)]));
  await put(db, addSeat('in_free', 1, { total: 0, amount_paid: 0, discount: { coupon: { percent_off: 100 } } }));
  report((await total(db)).sum === 500, 'a seat added under a 100% coupon was charged nothing and grants nothing');
}

{
  const db = await world();
  await put(db, addSeat('in_usd', 1, { currency: 'usd' }));
  report((await total(db)).n === 0, 'an invoice in any currency but euro grants nothing');
}

{
  const db = await world();
  await put(db, invoice('in_cycle', 'subscription_cycle', [proration(-450, 2), proration(450, 1), seatLine(3)]));
  report((await total(db)).sum === 1500, 'a renewal grants for the seats it bills, wherever the plan line sits among the lines');
}

{
  const db = await world();
  await put(db, invoice('in_legacy', 'subscription_cycle', [seatLine(1, LEGACY_PRICE, 800)], LEGACY, { parent: { subscription_details: { metadata: meta(LEGACY, '800') } } }));
  report((await total(db, LEGACY)).sum === 800, "the old feega_monthly_8 subscriber's renewal still grants 800");
}

{
  const db = await world();
  await put(db, addSeat('in_late', 1, { status: 'open' }));
  await db.query(`update stripe.invoices set _raw_data = jsonb_set(_raw_data, '{status}', '"paid"') where id = 'in_late'`);
  await db.query(`update stripe.invoices set _raw_data = _raw_data where id = 'in_late'`);
  report((await total(db)).n === 1, 'an invoice paid late and synced twice grants once');
}

{
  const db = await world();
  await subscribe(db, 'sub_paid', PAID, 'active');
  await setStatus(db, 'sub_paid', 'canceled');
  const after = await roles(db, PAID);
  report(
    after['p-owner'] === 'owner' && after['p-admin'] === 'viewer' && after['p-member'] === 'viewer',
    `when a paid team really ends, every editor but the owner becomes a viewer: got ${JSON.stringify(after)}`
  );
}

for (const status of ['unpaid', 'past_due', 'paused']) {
  const db = await world();
  await subscribe(db, 'sub_paid', PAID, 'active');
  await setStatus(db, 'sub_paid', status);
  const during = await roles(db, PAID);
  await setStatus(db, 'sub_paid', 'active');
  report(
    during['p-admin'] === 'admin' && during['p-member'] === 'member' && (await linked(db, PAID)) === 'sub_paid',
    `a ${status} subscription demotes nobody, and paying again restores it: got ${JSON.stringify(during)}`
  );
}

{
  const db = await world();
  await subscribe(db, 'sub_paid', PAID, 'active');
  await setStatus(db, 'sub_paid', 'paused');
  report((await linked(db, PAID)) === null, 'a paused subscription does not keep the team paid');
}

{
  const db = await world();
  await subscribe(db, 'sub_crowded', CROWDED_FREE, 'active');
  const flagWhilePaying = await flagged(db, CROWDED_FREE);
  await setStatus(db, 'sub_crowded', 'canceled');
  const after = await roles(db, CROWDED_FREE);
  report(!flagWhilePaying && after['c-member'] === 'viewer', `a grandfathered team that pays loses the flag, and cancelling then demotes like any team: got ${JSON.stringify(after)}`);
}

process.exit(failures ? 1 : 0);
