begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.frame_code_links (
  node_id       uuid primary key references public.nodes(id) on delete cascade,
  org_id        uuid not null references public.orgs(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  source        text not null default 'github' check (source in ('github', 'folder')),
  repo          text not null check (length(repo) between 3 and 1000),
  app_root      text not null default '' check (length(app_root) <= 500),
  entry_kind    text not null check (entry_kind in ('page', 'component')),
  entry         text not null check (length(entry) <= 500),
  role          text check (role in ('main', 'instance')),
  route         text check (length(route) <= 300),
  route_params  jsonb not null default '{}'::jsonb,
  base_branch   text not null check (length(base_branch) <= 200),
  base_sha      text not null check (length(base_sha) <= 64),
  files         text[] not null default '{}',
  push_branch   text check (length(push_branch) <= 200),
  push_sha      text check (length(push_sha) <= 64),
  push_parent   text check (length(push_parent) <= 64),
  push_touched  text[],
  pull_number   integer check (pull_number > 0),
  writable      boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (role is null or entry_kind = 'component')
);

create index if not exists frame_code_links_project_idx on public.frame_code_links (org_id, project_id);
create index if not exists frame_code_links_repo_idx on public.frame_code_links (repo, base_branch);
create index if not exists frame_code_links_created_by_idx on public.frame_code_links (created_by);

alter table public.frame_code_links enable row level security;

drop policy if exists "frame_code_links own org" on public.frame_code_links;
create policy "frame_code_links own org" on public.frame_code_links
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create table if not exists public.git_push_locks (
  org_id      uuid not null references public.orgs(id) on delete cascade,
  lock_key    text not null check (length(lock_key) <= 400),
  holder      uuid not null references public.profiles(id) on delete cascade,
  expires_at  timestamptz not null,
  primary key (org_id, lock_key)
);

create index if not exists git_push_locks_holder_idx on public.git_push_locks (holder);

alter table public.git_push_locks enable row level security;

drop policy if exists "git_push_locks own org" on public.git_push_locks;
create policy "git_push_locks own org" on public.git_push_locks
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

commit;
