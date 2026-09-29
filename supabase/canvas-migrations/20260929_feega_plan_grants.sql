begin;

do $$
declare
  _table text;
begin
  foreach _table in array array['checkout_sessions', 'subscriptions', 'invoices', 'prices'] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'stripe' and table_name = _table
    ) then
      raise exception 'install Stripe Sync first: stripe.% not found', _table;
    end if;
  end loop;
end;
$$;

create or replace function public.feega_credits(_value text) returns integer
  language sql immutable set search_path = '' as $$
  select case when _value ~ '^[1-9][0-9]{0,8}$' then _value::integer end;
$$;

create or replace function public.feega_org_from_metadata(_metadata jsonb) returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id
  from public.orgs o
  where _metadata->>'app' = 'feega'
    and o.id = case
      when _metadata->>'org_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (_metadata->>'org_id')::uuid
    end;
$$;

create or replace function public.credits_from_price_id(price_id text) returns integer
  language sql stable security definer set search_path = '' as $$
  select public.feega_credits(p._raw_data->'metadata'->>'credits')
  from stripe.prices p
  where p.id = price_id
    and p._raw_data->>'currency' = 'eur'
    and p._raw_data->'metadata'->>'app' = 'feega';
$$;

drop trigger if exists trg_grant_from_subscription on stripe.subscriptions;
drop function if exists public.grant_credits_from_stripe_subscription();

create or replace function public.link_org_to_stripe_subscription() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _org_id uuid := public.feega_org_from_metadata(NEW._raw_data->'metadata');
  _status text := NEW._raw_data->>'status';
begin
  if _org_id is null then
    return NEW;
  end if;

  if _status in ('active', 'trialing', 'past_due') then
    update public.orgs set stripe_subscription_id = NEW.id where id = _org_id;
  elsif _status in ('canceled', 'incomplete_expired', 'unpaid') then
    update public.orgs set stripe_subscription_id = null
    where id = _org_id and stripe_subscription_id = NEW.id;
  end if;

  return NEW;
end; $$;

create trigger trg_link_org_to_subscription
  after insert or update on stripe.subscriptions
  for each row execute function public.link_org_to_stripe_subscription();

create or replace function public.grant_credits_from_stripe_invoice() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _raw jsonb := NEW._raw_data;
  _subscription_metadata jsonb := coalesce(
    _raw->'parent'->'subscription_details'->'metadata',
    _raw->'subscription_details'->'metadata'
  );
  _line jsonb := _raw->'lines'->'data'->0;
  _org_id uuid;
  _credits integer;
  _period_end text;
begin
  if _raw->>'status' is distinct from 'paid' then
    return NEW;
  end if;
  if coalesce(_raw->>'billing_reason', '') not in ('subscription_create', 'subscription_cycle') then
    return NEW;
  end if;

  _org_id := public.feega_org_from_metadata(_subscription_metadata);
  if _org_id is null then
    return NEW;
  end if;

  _credits := coalesce(
    public.credits_from_price_id(coalesce(_line->'pricing'->'price_details'->>'price', _line->'price'->>'id')),
    public.feega_credits(_subscription_metadata->>'credits')
  );
  if _credits is null then
    return NEW;
  end if;

  _period_end := coalesce(_line->'period'->>'end', _raw->>'period_end');

  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_invoice_id, expires_at)
  values (
    _org_id, 'grant', 'subscription_renewal', _credits, 'invoice:' || NEW.id, NEW.id,
    case when _period_end ~ '^[0-9]+$' then to_timestamp(_period_end::bigint) end
  )
  on conflict (stripe_event_id) do nothing;

  return NEW;
end; $$;

drop trigger if exists trg_grant_from_invoice on stripe.invoices;
create trigger trg_grant_from_invoice
  after insert or update on stripe.invoices
  for each row execute function public.grant_credits_from_stripe_invoice();

create or replace function public.grant_credits_from_checkout_session() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _raw jsonb := NEW._raw_data;
  _org_id uuid;
  _credits integer;
begin
  if _raw->>'mode' is distinct from 'payment'
    or _raw->>'status' is distinct from 'complete'
    or _raw->>'payment_status' is distinct from 'paid' then
    return NEW;
  end if;

  _org_id := public.feega_org_from_metadata(_raw->'metadata');
  _credits := public.feega_credits(_raw->'metadata'->>'credits');
  if _org_id is null or _credits is null then
    return NEW;
  end if;

  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_checkout_id, expires_at)
  values (_org_id, 'grant', 'one_time_purchase', _credits, 'checkout:' || NEW.id, NEW.id, null)
  on conflict (stripe_event_id) do nothing;

  return NEW;
end; $$;

drop trigger if exists trg_grant_from_checkout on stripe.checkout_sessions;
create trigger trg_grant_from_checkout
  after insert or update on stripe.checkout_sessions
  for each row execute function public.grant_credits_from_checkout_session();

create or replace function public.billing_grants_ready() returns boolean
  language sql stable security definer set search_path = '' as $$
  select count(*) = 2
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'stripe'
    and (c.relname, t.tgname) in (('checkout_sessions', 'trg_grant_from_checkout'), ('invoices', 'trg_grant_from_invoice'));
$$;

revoke execute on function public.feega_org_from_metadata(jsonb) from public, anon, authenticated;
revoke execute on function public.credits_from_price_id(text) from public, anon, authenticated;
revoke execute on function public.link_org_to_stripe_subscription() from public, anon, authenticated;
revoke execute on function public.grant_credits_from_stripe_invoice() from public, anon, authenticated;
revoke execute on function public.grant_credits_from_checkout_session() from public, anon, authenticated;

commit;
