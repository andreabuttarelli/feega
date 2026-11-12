begin;

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
  elsif _status in ('canceled', 'incomplete_expired', 'unpaid') then
    update public.orgs set stripe_subscription_id = null
    where id = _org_id and stripe_subscription_id = NEW.id;

    if found then
      update public.orgs_members set role = 'viewer'
      where org_id = _org_id and role in ('admin', 'member');
    end if;
  end if;

  return NEW;
end; $$;

revoke execute on function public.link_org_to_stripe_subscription() from public, anon, authenticated;

commit;
