set lock_timeout = '3s';
set statement_timeout = '60s';

alter table public.orgs
  add column if not exists store_plan_product text,
  add column if not exists store_plan_store text,
  add column if not exists store_plan_expires_at timestamptz;

alter table public.credit_ledger add column if not exists store_event_id text;

create unique index if not exists credit_ledger_store_event_idx
  on public.credit_ledger (store_event_id, kind)
  where store_event_id is not null;

create table if not exists public.store_events (
  id text primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  store text not null,
  environment text not null check (environment in ('PRODUCTION', 'SANDBOX')),
  type text not null,
  product_id text,
  outcome text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists store_events_org_idx on public.store_events (org_id, received_at desc);

alter table public.store_events enable row level security;

drop policy if exists store_events_select on public.store_events;
create policy store_events_select on public.store_events
  for select using (org_id in (select auth_org_ids()));

create or replace function public.apply_store_event(
  _event_id text,
  _org_id uuid,
  _store text,
  _environment text,
  _type text,
  _product_id text,
  _payload jsonb,
  _outcome text,
  _grant_credits integer,
  _grant_source text,
  _grant_expires_at timestamptz,
  _revoke_credits integer,
  _plan text,
  _plan_expires_at timestamptz
) returns text
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_events (id, org_id, store, environment, type, product_id, outcome, payload)
  values (_event_id, _org_id, _store, _environment, _type, _product_id, _outcome, _payload)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if _grant_credits > 0 then
    insert into public.credit_ledger (org_id, kind, source, amount, store_event_id, expires_at, note)
    values (_org_id, 'grant', _grant_source, _grant_credits, _event_id, _grant_expires_at, _store || ' ' || _product_id);
  end if;

  if _revoke_credits > 0 then
    insert into public.credit_ledger (org_id, kind, source, amount, store_event_id, note)
    values (_org_id, 'debit', 'refund', _revoke_credits, _event_id, _store || ' refund ' || _product_id);
  end if;

  if _plan = 'set' then
    update public.orgs
    set store_plan_product = _product_id, store_plan_store = _store, store_plan_expires_at = _plan_expires_at
    where id = _org_id;
  elsif _plan = 'clear' then
    update public.orgs
    set store_plan_product = null, store_plan_store = null, store_plan_expires_at = null
    where id = _org_id and store_plan_product = _product_id;
  end if;

  return 'applied';
end; $$;

revoke execute on function public.apply_store_event(text, uuid, text, text, text, text, jsonb, text, integer, text, timestamptz, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_store_event(text, uuid, text, text, text, text, jsonb, text, integer, text, timestamptz, integer, text, timestamptz) to service_role;
