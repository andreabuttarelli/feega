begin;

create or replace function public.feega_price_unit_amount(price_id text) returns numeric
  language sql stable security definer set search_path = '' as $$
  select (p._raw_data->>'unit_amount')::numeric
  from stripe.prices p
  where p.id = price_id
    and p._raw_data->>'currency' = 'eur'
    and p._raw_data->'metadata'->>'app' = 'feega'
    and p._raw_data->>'unit_amount' ~ '^[1-9][0-9]*$';
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
  _line jsonb := _raw->'lines'->'data'->0;
  _quantity integer := case when _line->>'quantity' ~ '^[1-9][0-9]{0,3}$' then (_line->>'quantity')::integer else 1 end;
  _org_id uuid;
  _credits integer;
  _net numeric;
  _price text;
  _unit numeric;
begin
  if _raw->>'status' is distinct from 'paid' then
    return NEW;
  end if;
  if _reason not in ('subscription_create', 'subscription_cycle', 'subscription_update') then
    return NEW;
  end if;

  _org_id := public.feega_org_from_metadata(_subscription_metadata);
  if _org_id is null then
    return NEW;
  end if;

  if _reason = 'subscription_update' then
    select sum((l->>'amount')::numeric), min(coalesce(l->'pricing'->'price_details'->>'price', l->'price'->>'id'))
    into _net, _price
    from jsonb_array_elements(coalesce(_raw->'lines'->'data', '[]'::jsonb)) l
    where coalesce(l->>'proration', l->'parent'->'subscription_item_details'->>'proration') = 'true'
      and l->>'amount' ~ '^-?[0-9]+$';

    _unit := public.feega_price_unit_amount(_price);
    _credits := public.credits_from_price_id(_price);
    if _net is null or _net <= 0 or _unit is null or _credits is null then
      return NEW;
    end if;

    _credits := round(_net * _credits / _unit)::integer;
    if _credits <= 0 then
      return NEW;
    end if;
    _quantity := 1;
  else
    _credits := coalesce(
      public.credits_from_price_id(coalesce(_line->'pricing'->'price_details'->>'price', _line->'price'->>'id')),
      public.feega_credits(_subscription_metadata->>'credits')
    );
    if _credits is null then
      return NEW;
    end if;
  end if;

  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_invoice_id)
  values (_org_id, 'grant', 'subscription_renewal', _credits * _quantity, 'invoice:' || NEW.id, NEW.id)
  on conflict (stripe_event_id) do nothing;

  return NEW;
end; $$;

revoke execute on function public.feega_price_unit_amount(text) from public, anon, authenticated;
revoke execute on function public.grant_credits_from_stripe_invoice() from public, anon, authenticated;

commit;
