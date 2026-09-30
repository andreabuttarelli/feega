begin;

update public.feature_flags set key = 'uncensored_mode' where key = 'nsfw_mode';
insert into public.feature_flags (key, enabled) values ('uncensored_mode', false)
  on conflict (key) do nothing;

create or replace function public.project_is_uncensored(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select mode <> 'standard' from public.projects where id = p_project_id), false)
$$;

insert into public.billing_scopes (key) values ('uncensored') on conflict (key) do nothing;

create or replace function public.ai_calls_billing_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.billing_scope := case when public.project_is_uncensored(new.project_id) then 'uncensored' else 'standard' end;
  return new;
end $$;

update public.ai_calls set billing_scope = 'uncensored' where billing_scope = 'nsfw';
update public.credit_ledger set billing_scope = 'uncensored' where billing_scope = 'nsfw';
delete from public.billing_scopes where key = 'nsfw';

alter table public.assets
  add column if not exists uncensored_project boolean not null default false;

create or replace function public.assets_uncensored_from_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.uncensored_project := public.project_is_uncensored(new.project_id);
  return new;
end $$;

drop trigger if exists assets_nsfw_from_project on public.assets;
drop trigger if exists assets_uncensored_from_project on public.assets;
create trigger assets_uncensored_from_project before insert or update of project_id on public.assets
  for each row execute function public.assets_uncensored_from_project();

create or replace function public.canvases_no_share_in_uncensored()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.share_token is not null and public.project_is_uncensored(new.project_id) then
    raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists canvases_no_share_in_nsfw on public.canvases;
drop trigger if exists canvases_no_share_in_uncensored on public.canvases;
create trigger canvases_no_share_in_uncensored before insert or update of share_token on public.canvases
  for each row execute function public.canvases_no_share_in_uncensored();

create or replace function public.nodes_no_public_link_in_uncensored()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.public_token_hash is not null and public.project_is_uncensored(new.project_id) then
    raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists nodes_no_public_link_in_nsfw on public.nodes;
drop trigger if exists nodes_no_public_link_in_uncensored on public.nodes;
create trigger nodes_no_public_link_in_uncensored before insert or update of public_token_hash on public.nodes
  for each row execute function public.nodes_no_public_link_in_uncensored();

create or replace function public.post_sources_no_uncensored()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.nodes n
    where n.id = new.node_id and public.project_is_uncensored(n.project_id)
  ) then
    raise exception 'uncensored_not_publishable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists post_sources_no_nsfw on public.post_sources;
drop trigger if exists post_sources_no_uncensored on public.post_sources;
create trigger post_sources_no_uncensored before insert or update of node_id on public.post_sources
  for each row execute function public.post_sources_no_uncensored();

drop function if exists public.assets_nsfw_from_project();
drop function if exists public.canvases_no_share_in_nsfw();
drop function if exists public.nodes_no_public_link_in_nsfw();
drop function if exists public.post_sources_no_nsfw();
drop function if exists public.project_is_nsfw(uuid);

commit;
