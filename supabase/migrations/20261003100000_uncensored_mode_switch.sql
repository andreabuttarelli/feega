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

create or replace function public.uncensored_switch_refusal(p_org_id uuid, p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not coalesce((select enabled from public.feature_flags where key = 'uncensored_mode'), false) then 'coming_soon'
    when not exists (select 1 from public.orgs where id = p_org_id and stripe_subscription_id is not null) then 'plan_not_entitled'
    when not exists (select 1 from public.org_uncensored_optins where org_id = p_org_id and disabled_at is null) then 'org_not_opted_in'
    when p_user_id is null or not exists (select 1 from public.user_age_verifications where user_id = p_user_id) then 'age_unverified'
  end
$$;

create or replace function public.projects_mode_direction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  refusal text;
begin
  if new.mode = old.mode then
    return new;
  end if;
  if new.mode = 'standard' and public.project_has_uncensored_outputs(old.id) then
    raise exception 'uncensored_outputs_present' using errcode = 'check_violation';
  end if;
  if new.mode = 'uncensored' then
    refusal := public.uncensored_switch_refusal(old.org_id, auth.uid());
    if refusal is not null then
      raise exception '%', refusal using errcode = 'check_violation';
    end if;
    if public.project_has_shares(old.id) then
      raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists projects_mode_is_immutable on public.projects;
drop trigger if exists projects_mode_direction on public.projects;
create trigger projects_mode_direction before update of mode on public.projects
  for each row execute function public.projects_mode_direction();

commit;
