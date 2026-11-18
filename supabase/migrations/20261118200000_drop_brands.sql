set lock_timeout = '3s';
set statement_timeout = '60s';

update public.nodes set deleted_at = now() where type = 'ads' and deleted_at is null;

drop table if exists public.product_batch_items cascade;
drop table if exists public.product_batches cascade;
drop table if exists public.brand_fonts cascade;
drop table if exists public.brand_pins cascade;
drop table if exists public.ad_creatives cascade;
drop table if exists public.ad_campaigns cascade;
drop table if exists public.ad_accounts cascade;
drop table if exists public.competitor_ads cascade;
drop table if exists public.scheduled_posts cascade;
drop table if exists public.post_sources cascade;
drop table if exists public.posts cascade;
drop table if exists public.social_accounts cascade;

alter table if exists public.projects drop column if exists brand_id cascade;
alter table if exists public.assets drop column if exists brand_id cascade;
alter table if exists public.chat_threads drop column if exists brand_id cascade;
alter table if exists public.ai_calls drop column if exists brand_id cascade;
alter table if exists public.video_renders drop column if exists brand_id cascade;
alter table if exists public.products drop column if exists brand_id cascade;
alter table if exists public.social_posts drop column if exists brand_id cascade;

create or replace function public.storage_write_allowed(bucket text, object_name text)
 returns boolean
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  first text := (storage.foldername(object_name))[1];
  second text := (storage.foldername(object_name))[2];
  editor_orgs uuid[] := array(select public.auth_editor_org_ids());
begin
  if bucket = 'canvas-assets' then
    return case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'influencers' then
    return first = 'catalogue' or case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'embeds' then
    if split_part(object_name, '.', 1) !~* uuid_shape then
      return false;
    end if;
    return exists (select 1 from public.nodes n where n.id = split_part(object_name, '.', 1)::uuid and n.org_id = any(editor_orgs));
  end if;

  if bucket = 'media' and first = 'colours' then
    return case when second ~* uuid_shape then second::uuid = any(editor_orgs) else false end;
  end if;

  return true;
end $function$;

drop table if exists public.brands cascade;
drop function if exists public.guard_brands_zernio_profile_id() cascade;
