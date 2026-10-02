begin;

alter table public.nodes drop constraint if exists nodes_type_check;

alter table public.nodes add constraint nodes_type_check check (
  type in (
    'text', 'image', 'video', 'doc', 'iframe',
    'social_account_feed', 'social_post_mockup', 'products', 'ads',
    'influencer', 'list', 'select', 'effects', 'composition', 'calendar',
    'audio', 'model3d'
  )
);

alter table public.assets drop constraint if exists assets_type_check;

alter table public.assets add constraint assets_type_check check (
  type in ('text', 'image', 'video', 'iframe', 'document', 'audio', 'model3d')
);

alter table public.ai_models drop constraint if exists ai_models_catalogue_check;

alter table public.ai_models add constraint ai_models_catalogue_check check (
  catalogue in ('chat', 'image', 'video', 'model3d')
);

commit;
