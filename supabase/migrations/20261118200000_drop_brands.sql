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

drop table if exists public.brands cascade;
drop function if exists public.guard_brands_zernio_profile_id() cascade;
