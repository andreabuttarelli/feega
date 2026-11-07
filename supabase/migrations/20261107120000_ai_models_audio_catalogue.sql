set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.ai_models drop constraint if exists ai_models_catalogue_check;
alter table public.ai_models
  add constraint ai_models_catalogue_check check (catalogue in ('chat', 'image', 'video', 'model3d', 'audio'));
