begin;

alter table public.orgs add column if not exists editor_seats_grandfathered_at timestamptz;

update public.orgs o
set editor_seats_grandfathered_at = now()
where o.stripe_subscription_id is null
  and o.editor_seats_grandfathered_at is null
  and (
    select count(*) from public.orgs_members m
    where m.org_id = o.id and m.role in ('owner', 'admin', 'member')
  ) > 1;

commit;
