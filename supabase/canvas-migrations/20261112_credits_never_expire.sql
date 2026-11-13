begin;

create or replace function public.org_credit_balance(_org_id uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when kind = 'grant' then amount else -amount end), 0)::integer
  from public.credit_ledger
  where org_id = _org_id
    and (auth.role() = 'service_role' or _org_id in (select auth_org_ids()));
$$;

revoke execute on function public.org_credit_balance(uuid) from public, anon;
grant execute on function public.org_credit_balance(uuid) to authenticated, service_role;

create or replace function public.grant_credits_from_stripe_invoice() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _raw jsonb := NEW._raw_data;
  _subscription_metadata jsonb := coalesce(
    _raw->'parent'->'subscription_details'->'metadata',
    _raw->'subscription_details'->'metadata'
  );
  _line jsonb := _raw->'lines'->'data'->0;
  _quantity integer := case when _line->>'quantity' ~ '^[1-9][0-9]{0,3}$' then (_line->>'quantity')::integer else 1 end;
  _org_id uuid;
  _credits integer;
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

  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_invoice_id)
  values (_org_id, 'grant', 'subscription_renewal', _credits * _quantity, 'invoice:' || NEW.id, NEW.id)
  on conflict (stripe_event_id) do nothing;

  return NEW;
end; $$;

revoke execute on function public.grant_credits_from_stripe_invoice() from public, anon, authenticated;

drop view if exists public.org_credits_at_risk;

commit;
