begin;

do $$ begin
  create type public.project_mode as enum ('standard', 'nsfw');
exception when duplicate_object then null;
end $$;

alter table public.projects
  add column if not exists mode public.project_mode not null default 'standard';

create or replace function public.projects_mode_is_immutable()
returns trigger language plpgsql as $$
begin
  if new.mode is distinct from old.mode then
    raise exception 'project_mode_immutable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists projects_mode_is_immutable on public.projects;
create trigger projects_mode_is_immutable before update of mode on public.projects
  for each row execute function public.projects_mode_is_immutable();

create or replace function public.project_is_nsfw(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select mode = 'nsfw' from public.projects where id = p_project_id), false)
$$;

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags readable" on public.feature_flags;
create policy "feature_flags readable" on public.feature_flags
  for select to authenticated using (true);

insert into public.feature_flags (key, enabled) values ('nsfw_mode', false)
  on conflict (key) do nothing;

create table if not exists public.user_age_verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  provider     text not null,
  method       text not null,
  result       text not null check (result = 'adult'),
  verified_at  timestamptz not null default now()
);

create index if not exists user_age_verifications_user_idx on public.user_age_verifications (user_id, verified_at desc);

alter table public.user_age_verifications enable row level security;

drop policy if exists "age verifications read own" on public.user_age_verifications;
create policy "age verifications read own" on public.user_age_verifications
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.billing_scopes (
  key  text primary key
);

insert into public.billing_scopes (key) values ('standard'), ('nsfw') on conflict (key) do nothing;

alter table public.billing_scopes enable row level security;

drop policy if exists "billing_scopes readable" on public.billing_scopes;
create policy "billing_scopes readable" on public.billing_scopes
  for select to authenticated using (true);

alter table public.ai_calls
  add column if not exists billing_scope text not null default 'standard' references public.billing_scopes(key);

alter table public.credit_ledger
  add column if not exists billing_scope text not null default 'standard' references public.billing_scopes(key);

create or replace function public.ai_calls_billing_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.billing_scope := case when public.project_is_nsfw(new.project_id) then 'nsfw' else 'standard' end;
  return new;
end $$;

drop trigger if exists ai_calls_billing_scope on public.ai_calls;
create trigger ai_calls_billing_scope before insert on public.ai_calls
  for each row execute function public.ai_calls_billing_scope();

create or replace function public.credit_ledger_billing_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.billing_scope := coalesce((select billing_scope from public.ai_calls where id = new.ai_call_id), 'standard');
  return new;
end $$;

drop trigger if exists credit_ledger_billing_scope on public.credit_ledger;
create trigger credit_ledger_billing_scope before insert on public.credit_ledger
  for each row execute function public.credit_ledger_billing_scope();

alter table public.assets
  add column if not exists nsfw boolean not null default false;

create or replace function public.assets_nsfw_from_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.nsfw := public.project_is_nsfw(new.project_id);
  return new;
end $$;

drop trigger if exists assets_nsfw_from_project on public.assets;
create trigger assets_nsfw_from_project before insert or update of project_id on public.assets
  for each row execute function public.assets_nsfw_from_project();

create or replace function public.canvases_no_share_in_nsfw()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.share_token is not null and public.project_is_nsfw(new.project_id) then
    raise exception 'nsfw_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists canvases_no_share_in_nsfw on public.canvases;
create trigger canvases_no_share_in_nsfw before insert or update of share_token on public.canvases
  for each row execute function public.canvases_no_share_in_nsfw();

create or replace function public.nodes_no_public_link_in_nsfw()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.public_token_hash is not null and public.project_is_nsfw(new.project_id) then
    raise exception 'nsfw_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists nodes_no_public_link_in_nsfw on public.nodes;
create trigger nodes_no_public_link_in_nsfw before insert or update of public_token_hash on public.nodes
  for each row execute function public.nodes_no_public_link_in_nsfw();

create or replace function public.post_sources_no_nsfw()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.nodes n join public.projects p on p.id = n.project_id
    where n.id = new.node_id and p.mode = 'nsfw'
  ) then
    raise exception 'nsfw_not_publishable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists post_sources_no_nsfw on public.post_sources;
create trigger post_sources_no_nsfw before insert or update of node_id on public.post_sources
  for each row execute function public.post_sources_no_nsfw();

commit;
