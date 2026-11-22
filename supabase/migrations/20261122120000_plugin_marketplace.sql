begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.plugins (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name text not null,
  summary text not null,
  author text not null,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  latest_version text not null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plugin_installs (
  plugin_id text not null references public.plugins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  unique (plugin_id, user_id)
);

create table if not exists public.plugin_votes (
  plugin_id text not null references public.plugins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plugin_id, user_id)
);

create index if not exists plugin_installs_user_idx on public.plugin_installs (user_id);
create index if not exists plugin_installs_org_idx on public.plugin_installs (org_id);
create index if not exists plugin_votes_user_idx on public.plugin_votes (user_id);

alter table public.plugins enable row level security;
alter table public.plugin_installs enable row level security;
alter table public.plugin_votes enable row level security;

create policy plugins_public_read on public.plugins
  for select to anon, authenticated
  using (true);

create policy plugin_installs_own_select on public.plugin_installs
  for select to authenticated
  using (user_id = auth.uid());

create policy plugin_installs_own_insert on public.plugin_installs
  for insert to authenticated
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));

create policy plugin_installs_own_update on public.plugin_installs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));

create policy plugin_votes_own_select on public.plugin_votes
  for select to authenticated
  using (user_id = auth.uid());

create policy plugin_votes_own_insert on public.plugin_votes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy plugin_votes_own_delete on public.plugin_votes
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.plugins, public.plugin_installs, public.plugin_votes from anon, authenticated;
grant select on public.plugins to anon, authenticated;
grant select, insert, update on public.plugin_installs to authenticated;
grant select, insert, delete on public.plugin_votes to authenticated;

create or replace function public.plugin_catalogue(p_id text default null, p_active_since timestamptz default now() - interval '30 days')
returns table (
  id text,
  name text,
  summary text,
  author text,
  tier text,
  latest_version text,
  manifest jsonb,
  installs bigint,
  active_installs bigint,
  upvotes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.summary,
    p.author,
    p.tier,
    p.latest_version,
    p.manifest,
    (select count(*) from public.plugin_installs i where i.plugin_id = p.id and i.uninstalled_at is null),
    (select count(*) from public.plugin_installs i where i.plugin_id = p.id and i.uninstalled_at is null and i.enabled and i.last_seen_at >= p_active_since),
    (select count(*) from public.plugin_votes v where v.plugin_id = p.id)
  from public.plugins p
  where p_id is null or p.id = p_id
  order by p.name
$$;

revoke all on function public.plugin_catalogue(text, timestamptz) from public;
grant execute on function public.plugin_catalogue(text, timestamptz) to anon, authenticated;

commit;
