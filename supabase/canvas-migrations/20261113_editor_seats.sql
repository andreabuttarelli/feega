begin;

alter table public.orgs
  add column if not exists editor_seats_grandfathered_at timestamptz,
  add column if not exists seats_paid integer,
  add column if not exists seats_paid_until timestamptz,
  add column if not exists seats_checked_at timestamptz,
  add column if not exists seats_sync_until timestamptz;

update public.orgs o
set editor_seats_grandfathered_at = now()
where o.stripe_subscription_id is null
  and o.editor_seats_grandfathered_at is null
  and (
    select count(*) from public.orgs_members m
    where m.org_id = o.id and m.role in ('owner', 'admin', 'member')
  ) > 1;

update public.orgs o
set seats_paid = (s._raw_data->'items'->'data'->0->>'quantity')::integer,
    seats_paid_until = to_timestamp((s._raw_data->'items'->'data'->0->>'current_period_end')::bigint)
from stripe.subscriptions s
where s.id = o.stripe_subscription_id
  and o.seats_paid is null
  and s._raw_data->'items'->'data'->0->'price'->>'lookup_key' = 'feega_monthly_9'
  and s._raw_data->'items'->'data'->0->>'quantity' ~ '^[1-9][0-9]{0,3}$'
  and s._raw_data->'items'->'data'->0->>'current_period_end' ~ '^[0-9]+$';

create or replace function public.feega_price_unit_amount(price_id text) returns numeric
  language sql stable security definer set search_path = '' as $$
  select (p._raw_data->>'unit_amount')::numeric
  from stripe.prices p
  where p.id = price_id
    and p._raw_data->>'currency' = 'eur'
    and p._raw_data->'metadata'->>'app' = 'feega'
    and p._raw_data->>'unit_amount' ~ '^[1-9][0-9]*$';
$$;

create or replace function public.feega_line_price(_line jsonb) returns text
  language sql immutable set search_path = '' as $$
  select coalesce(_line->'pricing'->'price_details'->>'price', _line->'price'->>'id');
$$;

create or replace function public.feega_line_quantity(_line jsonb) returns integer
  language sql immutable set search_path = '' as $$
  select case when _line->>'quantity' ~ '^[1-9][0-9]{0,3}$' then (_line->>'quantity')::integer else 1 end;
$$;

create or replace function public.feega_line_is_proration(_line jsonb) returns boolean
  language sql immutable set search_path = '' as $$
  select coalesce(_line->>'proration', _line->'parent'->'subscription_item_details'->>'proration', 'false') = 'true';
$$;

create or replace function public.grant_credits_from_stripe_invoice() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _raw jsonb := NEW._raw_data;
  _reason text := coalesce(_raw->>'billing_reason', '');
  _subscription_metadata jsonb := coalesce(
    _raw->'parent'->'subscription_details'->'metadata',
    _raw->'subscription_details'->'metadata'
  );
  _lines jsonb := coalesce(_raw->'lines'->'data', '[]'::jsonb);
  _org_id uuid;
  _credits integer;
  _net numeric;
  _charged numeric;
  _price text;
  _unit numeric;
  _per_seat integer;
begin
  if _raw->>'status' is distinct from 'paid' or _raw->>'currency' is distinct from 'eur' then
    return NEW;
  end if;
  if _reason not in ('subscription_create', 'subscription_cycle', 'subscription_update') then
    return NEW;
  end if;

  _org_id := public.feega_org_from_metadata(_subscription_metadata);
  if _org_id is null then
    return NEW;
  end if;

  if _reason in ('subscription_create', 'subscription_cycle') then
    select sum(public.credits_from_price_id(public.feega_line_price(l)) * public.feega_line_quantity(l))
    into _credits
    from jsonb_array_elements(_lines) l
    where not public.feega_line_is_proration(l)
      and public.credits_from_price_id(public.feega_line_price(l)) is not null;

    if _credits is null then
      select public.feega_credits(_subscription_metadata->>'credits') * public.feega_line_quantity(l)
      into _credits
      from jsonb_array_elements(_lines) l
      where not public.feega_line_is_proration(l)
      limit 1;
    end if;
    if _credits is null or _credits <= 0 then
      return NEW;
    end if;
  else
    select sum((l->>'amount')::numeric), min(public.feega_line_price(l))
    into _net, _price
    from jsonb_array_elements(_lines) l
    where public.feega_line_is_proration(l)
      and l->>'amount' ~ '^-?[0-9]+$';

    _charged := least(_net, coalesce(case when _raw->>'total' ~ '^-?[0-9]+$' then (_raw->>'total')::numeric end, _net));
    _unit := public.feega_price_unit_amount(_price);
    _per_seat := public.credits_from_price_id(_price);
    if _charged is null or _charged <= 0 or _unit is null or _per_seat is null then
      return NEW;
    end if;

    _credits := round(_charged * _per_seat / _unit)::integer;
    if _credits <= 0 then
      return NEW;
    end if;
  end if;

  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_invoice_id)
  values (_org_id, 'grant', 'subscription_renewal', _credits, 'invoice:' || NEW.id, NEW.id)
  on conflict (stripe_event_id) do nothing;

  return NEW;
end; $$;

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
    update public.orgs
    set stripe_subscription_id = NEW.id, editor_seats_grandfathered_at = null
    where id = _org_id;
  elsif _status = 'unpaid' then
    update public.orgs set stripe_subscription_id = NEW.id
    where id = _org_id and (stripe_subscription_id is null or stripe_subscription_id = NEW.id);

    if found then
      update public.orgs_members set role = 'viewer'
      where org_id = _org_id and role in ('admin', 'member');
    end if;
  elsif _status in ('canceled', 'incomplete_expired') then
    update public.orgs set stripe_subscription_id = null, seats_paid = null, seats_paid_until = null
    where id = _org_id and stripe_subscription_id = NEW.id;

    if found then
      update public.orgs_members set role = 'viewer'
      where org_id = _org_id and role in ('admin', 'member');
    end if;
  elsif _status = 'paused' then
    update public.orgs set stripe_subscription_id = null
    where id = _org_id and stripe_subscription_id = NEW.id;
  end if;

  return NEW;
end; $$;

create or replace function public.record_paid_seats(p_org_id uuid, p_seats integer, p_until timestamptz) returns void
  language sql security definer set search_path = '' as $$
  update public.orgs
  set seats_paid = case
        when seats_paid_until is not distinct from p_until then greatest(coalesce(seats_paid, 0), p_seats)
        else p_seats
      end,
      seats_paid_until = p_until
  where id = p_org_id
    and (seats_paid_until is null or p_until is null or seats_paid_until <= p_until);
$$;

create or replace function public.claim_seat_sync(p_org_id uuid, p_ms integer) returns boolean
  language plpgsql security definer set search_path = '' as $$
begin
  update public.orgs set seats_sync_until = now() + make_interval(secs => p_ms / 1000.0)
  where id = p_org_id and (seats_sync_until is null or seats_sync_until < now());
  return found;
end; $$;

create or replace function public.release_seat_sync(p_org_id uuid) returns void
  language sql security definer set search_path = '' as $$
  update public.orgs set seats_sync_until = null where id = p_org_id;
$$;

revoke execute on function public.record_paid_seats(uuid, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_seat_sync(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_seat_sync(uuid) from public, anon, authenticated;
revoke execute on function public.feega_price_unit_amount(text) from public, anon, authenticated;
revoke execute on function public.grant_credits_from_stripe_invoice() from public, anon, authenticated;
revoke execute on function public.link_org_to_stripe_subscription() from public, anon, authenticated;

commit;
