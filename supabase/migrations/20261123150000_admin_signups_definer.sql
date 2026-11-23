begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.admin_signups_weekly()
returns table(week date, total bigint, confirmed bigint)
language sql
stable
security definer
set search_path to ''
as $function$
  select date_trunc('week', u.created_at)::date,
    count(*),
    count(*) filter (where u.email_confirmed_at is not null)
  from auth.users u
  where u.created_at >= date_trunc('week', now()) - interval '11 weeks'
    and split_part(lower(u.email), '@', 2) not in (select b.domain from public.blocked_email_domains b)
  group by 1
  order by 1
$function$;

revoke all on function public.admin_signups_weekly() from public, anon, authenticated;
grant execute on function public.admin_signups_weekly() to service_role;

commit;
