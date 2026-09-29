begin;

alter table public.nodes drop constraint if exists nodes_type_check;

alter table public.nodes add constraint nodes_type_check check (
  type in (
    'text', 'image', 'video', 'doc', 'iframe',
    'social_account_feed', 'social_post_mockup', 'products', 'ads',
    'influencer', 'list', 'select', 'effects', 'composition', 'calendar'
  )
);

alter table public.posts add column if not exists planned_for timestamptz;

create index if not exists posts_brand_planned_for_idx on public.posts (brand_id, planned_for)
  where planned_for is not null;

commit;
