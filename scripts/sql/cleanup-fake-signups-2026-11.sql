-- Fake sign-ups of November 2026. Not a migration: never applied automatically.
-- Step 1 is read-only. Step 2 deletes: run it only after reading the step 1 output.
-- Every foreign key to auth.users and public.orgs is ON DELETE CASCADE or SET NULL
-- (baseline plus migrations through 20261121), so deleting the org and the auth user
-- removes memberships, profiles, billing rows, usage rows and old-product rows.
-- Storage files uploaded by these users are not removed by SQL; step 1 counts them.

-- Step 1: review
with target_domains(domain) as (
  values ('ghoil.xyz'), ('abadabra.me'), ('kadal.me'), ('termanila.media'),
         ('kayou.site'), ('yugo.life'), ('agolos.live'), ('harsenpit.com')
),
fake_users as (
  select u.id, u.email, u.created_at, u.last_sign_in_at,
         u.raw_app_meta_data ->> 'provider' as provider
  from auth.users u
  join target_domains d
    on lower(split_part(u.email, '@', 2)) = d.domain
    or lower(split_part(u.email, '@', 2)) like '%.' || d.domain
),
fake_orgs as (
  select o.id, o.name, o.stripe_customer_id, o.stripe_subscription_id,
         count(m.user_id) as members,
         count(m.user_id) filter (where m.user_id in (select id from fake_users)) as fake_members
  from public.orgs o
  join public.orgs_members m on m.org_id = o.id
  where o.id in (
    select org_id from public.orgs_members where user_id in (select id from fake_users)
  )
  group by o.id
)
select
  (select count(*) from fake_users) as fake_user_count,
  u.email, u.provider, u.created_at, u.last_sign_in_at,
  o.id as org_id, o.name as org_name, o.members, o.fake_members,
  o.stripe_subscription_id is not null as has_subscription,
  (o.members = o.fake_members and o.stripe_subscription_id is null) as org_will_be_deleted,
  (select count(*) from storage.objects so where so.owner = u.id) as storage_files
from fake_users u
left join public.orgs_members m on m.user_id = u.id
left join fake_orgs o on o.id = m.org_id
order by u.created_at, u.email;

-- Step 2: delete. Uncomment from "begin;" to "commit;" and run as one script.
-- Orgs shared with a real member or carrying a Stripe subscription are kept
-- (their fake members are removed with the auth users).
--
-- begin;
--
-- set local lock_timeout = '5s';
-- set local statement_timeout = '120s';
--
-- create temp table fake_user_ids on commit drop as
-- select u.id
-- from auth.users u
-- where lower(split_part(u.email, '@', 2)) = any (array[
--         'ghoil.xyz', 'abadabra.me', 'kadal.me', 'termanila.media',
--         'kayou.site', 'yugo.life', 'agolos.live', 'harsenpit.com'])
--    or lower(split_part(u.email, '@', 2)) like any (array[
--         '%.ghoil.xyz', '%.abadabra.me', '%.kadal.me', '%.termanila.media',
--         '%.kayou.site', '%.yugo.life', '%.agolos.live', '%.harsenpit.com']);
--
-- create temp table fake_org_ids on commit drop as
-- select o.id
-- from public.orgs o
-- where o.stripe_subscription_id is null
--   and exists (select 1 from public.orgs_members m where m.org_id = o.id and m.user_id in (select id from fake_user_ids))
--   and not exists (select 1 from public.orgs_members m where m.org_id = o.id and m.user_id not in (select id from fake_user_ids));
--
-- delete from public.orgs where id in (select id from fake_org_ids);
-- delete from auth.users where id in (select id from fake_user_ids);
--
-- select (select count(*) from fake_user_ids) as users_deleted,
--        (select count(*) from fake_org_ids) as orgs_deleted;
--
-- commit;
