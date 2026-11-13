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
  await db.query('insert into stripe.subscriptions (_raw_data) values ($1)', [
    { id: 'sub_paid', status: 'active', metadata: meta(PAID), items: { data: [{ quantity: 3, current_period_end: PERIOD_END, price: { lookup_key: 'feega_monthly_9' } }] } }
  ]);
  await db.exec(migration(SEATS));
  return db;
}

const put = (db, raw) => db.query('insert into stripe.invoices (_raw_data) values ($1)', [raw]);
const total = async (db, org = PAID) => (await db.query('select coalesce(sum(amount), 0)::int as sum, count(*)::int as n from credit_ledger where org_id = $1', [org])).rows[0];
const roles = async (db, org) => Object.fromEntries((await db.query('select user_id, role from orgs_members where org_id = $1', [org])).rows.map((r) => [r.user_id, r.role]));
const flagged = async (db, org) => (await db.query('select editor_seats_grandfathered_at is not null as on from orgs where id = $1', [org])).rows[0].on;
const subscribe = (db, id, org, status) => db.query('insert into stripe.subscriptions (_raw_data) values ($1) on conflict (id) do update set _raw_data = excluded._raw_data', [{ id, status, metadata: meta(org) }]);
const setStatus = (db, id, status) => db.query(`update stripe.subscriptions set _raw_data = jsonb_set(_raw_data, '{status}', to_jsonb($2::text)) where id = $1`, [id, status]);
const linked = async (db, org) => (await db.query('select stripe_subscription_id from orgs where id = $1', [org])).rows[0].stripe_subscription_id;

{
  const db = await world();
  const row = (await db.query('select seats_paid, extract(epoch from seats_paid_until)::bigint as until from orgs where id = $1', [PAID])).rows[0];
  report(row.seats_paid === 3 && Number(row.until) === PERIOD_END, `a per-editor subscription that existed before the migration starts with its paid seats recorded: got ${JSON.stringify(row)}`);
}

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
  await put(db, invoice('in_rm', 'subscription_update', [proration(-900, 2), proration(450, 1)], PAID, { total: -450 }));
  report((await total(db)).n === 0, 'a removed seat writes no ledger row');
}

{
  const db = await world();
  await put(db, invoice('in_create', 'subscription_create', [seatLine(1)]));
  await put(db, invoice('in_B', 'subscription_update', [proration(-900, 2), proration(1350, 3)]));
  await put(db, invoice('in_A', 'subscription_update', [proration(-450, 1), proration(900, 2)]));
  const got = await total(db);
  report(got.sum === 1000 && got.n === 3, `two charged adds synced out of order each grant what they charged: got ${JSON.stringify(got)}`);
}

{
  const db = await world();
  await put(db, invoice('in_A', 'subscription_update', [proration(-450, 1), proration(900, 2)]));
  await put(db, invoice('in_create', 'subscription_create', [seatLine(1)]));
  const got = await total(db);
  report(got.sum === 750 && got.n === 2, `an add synced before the create invoice still grants once each: got ${JSON.stringify(got)}`);
}

{
  const db = await world();
  await put(db, invoice('in_single', 'subscription_update', [proration(450, 1)]));
  report((await total(db)).sum === 250, 'a seat add written by Stripe as one line for the added seat grants what it charged');
}

{
  const db = await world();
  await put(db, invoice('in_balance', 'subscription_update', [proration(-450, 1), proration(900, 2)], PAID, { amount_due: 0, amount_paid: 0, starting_balance: -450 }));
  report((await total(db)).sum === 250, "a seat add paid from the customer's balance grants what the invoice charged");
}

{
  const db = await world();
  await put(db, invoice('in_tax', 'subscription_update', [proration(-450, 1), proration(900, 2)], PAID, { total: 545 }));
  report((await total(db)).sum === 250, 'tax on top of the seat grants nothing extra');
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

const journey = async (statuses) => {
  const db = await world();
  for (const status of statuses) {
    await subscribe(db, 'sub_paid', PAID, status).catch(() => setStatus(db, 'sub_paid', status));
  }
  return { roles: await roles(db, PAID), linked: await linked(db, PAID) };
};

{
  const got = await journey(['active', 'past_due', 'active']);
  report(got.roles['p-admin'] === 'admin' && got.roles['p-member'] === 'member' && got.linked === 'sub_paid', `a past-due payment that recovers demotes nobody: got ${JSON.stringify(got)}`);
}

{
  const got = await journey(['active', 'past_due', 'canceled']);
  report(got.roles['p-owner'] === 'owner' && got.roles['p-admin'] === 'viewer' && got.linked === null, `past due then cancelled demotes at the end: got ${JSON.stringify(got)}`);
}

{
  const got = await journey(['active', 'unpaid']);
  report(got.roles['p-owner'] === 'owner' && got.roles['p-admin'] === 'viewer' && got.roles['p-member'] === 'viewer' && got.linked === 'sub_paid', `an unpaid subscription keeps the team linked and turns unpaid editors into viewers: got ${JSON.stringify(got)}`);
}

{
  const got = await journey(['active', 'unpaid', 'canceled']);
  report(got.roles['p-admin'] === 'viewer' && got.linked === null, `unpaid then cancelled ends the plan: got ${JSON.stringify(got)}`);
}

{
  const got = await journey(['active', 'unpaid', 'active']);
  report(got.roles['p-admin'] === 'viewer' && got.linked === 'sub_paid', `paying an unpaid plan again restores the plan, not the editor roles: got ${JSON.stringify(got)}`);
}

{
  const got = await journey(['active', 'paused']);
  report(got.roles['p-admin'] === 'admin' && got.linked === null, `a paused subscription demotes nobody and does not keep the team paid: got ${JSON.stringify(got)}`);
}

{
  const db = await world();
  await subscribe(db, 'sub_paid', PAID, 'active');
  await subscribe(db, 'sub_old', PAID, 'unpaid');
  report((await linked(db, PAID)) === 'sub_paid' && (await roles(db, PAID))['p-admin'] === 'admin', 'an old unpaid subscription re-synced never takes over a team paying on another one');
}

{
  const db = await world();
  const until = new Date(PERIOD_END * 1000).toISOString();
  const later = new Date((PERIOD_END + 2_592_000) * 1000).toISOString();
  const paid = async () => (await db.query('select seats_paid from orgs where id = $1', [PAID])).rows[0].seats_paid;
  await db.query('select public.record_paid_seats($1, 5, $2)', [PAID, until]);
  await db.query('select public.record_paid_seats($1, 2, $2)', [PAID, until]);
  const samePeriod = await paid();
  await db.query('select public.record_paid_seats($1, 2, $2)', [PAID, later]);
  report(samePeriod === 5 && (await paid()) === 2, `paid seats only go up within a period, and a new period starts over: got ${samePeriod} then ${await paid()}`);
}

{
  const db = await world();
  const claim = async () => (await db.query('select public.claim_seat_sync($1, 30000) as ok', [PAID])).rows[0].ok;
  const first = await claim();
  const second = await claim();
  await db.query('select public.release_seat_sync($1)', [PAID]);
  report(first === true && second === false && (await claim()) === true, 'one seat change per team at a time: a second claim waits until the first releases');
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
