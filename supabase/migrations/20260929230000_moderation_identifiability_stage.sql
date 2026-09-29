begin;

alter table public.moderation_checks
  drop constraint if exists moderation_checks_stage_check;

alter table public.moderation_checks
  add constraint moderation_checks_stage_check
  check (stage in ('rules', 'jev', 'llm', 'identifiability'));

commit;
