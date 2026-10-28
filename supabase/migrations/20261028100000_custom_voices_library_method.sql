set lock_timeout = '3s';
set statement_timeout = '30s';

alter table public.custom_voices drop constraint if exists custom_voices_method_check;
alter table public.custom_voices
  add constraint custom_voices_method_check check (method in ('design', 'instant_clone', 'library'));
