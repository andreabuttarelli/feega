begin;

create or replace function public.project_has_uncensored_outputs(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assets where project_id = p_project_id and uncensored_project)
      or exists (select 1 from public.ai_calls where project_id = p_project_id and billing_scope = 'uncensored')
$$;

create or replace function public.project_has_shares(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.canvases where project_id = p_project_id and share_token is not null)
      or exists (select 1 from public.nodes where project_id = p_project_id and public_token_hash is not null)
$$;

create or replace function public.projects_mode_direction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.mode = old.mode then
    return new;
  end if;
  if new.mode = 'standard' and public.project_has_uncensored_outputs(old.id) then
    raise exception 'uncensored_outputs_present' using errcode = 'check_violation';
  end if;
  if new.mode = 'uncensored' and public.project_has_shares(old.id) then
    raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists projects_mode_is_immutable on public.projects;
drop trigger if exists projects_mode_direction on public.projects;
create trigger projects_mode_direction before update of mode on public.projects
  for each row execute function public.projects_mode_direction();

commit;
