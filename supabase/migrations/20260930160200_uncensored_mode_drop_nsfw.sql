begin;

alter table public.assets drop column if exists nsfw;

drop trigger if exists projects_mode_is_immutable on public.projects;
alter table public.projects alter column mode drop default;
alter type public.project_mode rename to project_mode_before_uncensored;
create type public.project_mode as enum ('standard', 'uncensored');
alter table public.projects
  alter column mode type public.project_mode
  using (case mode::text when 'nsfw' then 'uncensored' else mode::text end)::public.project_mode;
alter table public.projects alter column mode set default 'standard';
drop type public.project_mode_before_uncensored;
create trigger projects_mode_is_immutable before update of mode on public.projects
  for each row execute function public.projects_mode_is_immutable();

commit;
