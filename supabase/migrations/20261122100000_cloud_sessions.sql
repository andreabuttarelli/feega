begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.cloud_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.share_sessions (
  id text primary key check (id ~ '^[a-z2-7]{10}$'),
  org_id uuid not null references public.orgs (id) on delete cascade,
  project_id uuid not null references public.cloud_projects (id) on delete cascade,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  project_name text not null,
  visitor_role text not null check (visitor_role in ('viewer', 'editor')),
  status text not null default 'live' check (status in ('live', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  expires_at timestamptz not null,
  snapshot_path text
);

create table if not exists public.share_members (
  session_id text not null references public.share_sessions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (session_id, user_id)
);

create table if not exists public.share_comments (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.share_sessions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  selector text not null,
  source_file text not null,
  source_line integer not null,
  source_col integer not null,
  parent_id uuid references public.share_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolve_note text
);

create index if not exists cloud_projects_org_idx on public.cloud_projects (org_id);
create index if not exists share_sessions_org_status_idx on public.share_sessions (org_id, status);
create index if not exists share_sessions_host_idx on public.share_sessions (host_user_id);
create index if not exists share_sessions_project_idx on public.share_sessions (project_id);
create index if not exists share_members_org_idx on public.share_members (org_id);
create index if not exists share_members_user_idx on public.share_members (user_id);
create index if not exists share_comments_session_idx on public.share_comments (session_id, created_at);
create index if not exists share_comments_org_idx on public.share_comments (org_id);
create index if not exists share_comments_author_idx on public.share_comments (author_id);
create index if not exists share_comments_parent_idx on public.share_comments (parent_id);

alter table public.cloud_projects enable row level security;
alter table public.share_sessions enable row level security;
alter table public.share_members enable row level security;
alter table public.share_comments enable row level security;

create policy cloud_projects_read on public.cloud_projects for select
  using (org_id in (select public.auth_org_ids()));
create policy cloud_projects_insert on public.cloud_projects for insert
  with check (org_id in (select public.auth_editor_org_ids()));

create policy share_sessions_read on public.share_sessions for select
  using (org_id in (select public.auth_org_ids()));
create policy share_sessions_insert on public.share_sessions for insert
  with check (org_id in (select public.auth_editor_org_ids()) and host_user_id = auth.uid());
create policy share_sessions_update on public.share_sessions for update
  using (host_user_id = auth.uid() and org_id in (select public.auth_org_ids()))
  with check (host_user_id = auth.uid() and org_id in (select public.auth_org_ids()));

create policy share_members_read on public.share_members for select
  using (org_id in (select public.auth_org_ids()));
create policy share_members_join on public.share_members for insert
  with check (
    org_id in (select public.auth_org_ids())
    and (
      (user_id = auth.uid() and role = (select s.visitor_role from public.share_sessions s where s.id = session_id and s.org_id = org_id))
      or exists (select 1 from public.share_sessions s where s.id = session_id and s.org_id = org_id and s.host_user_id = auth.uid())
    )
  );
create policy share_members_host_update on public.share_members for update
  using (exists (select 1 from public.share_sessions s where s.id = session_id and s.host_user_id = auth.uid()))
  with check (exists (select 1 from public.share_sessions s where s.id = session_id and s.host_user_id = auth.uid()));

create policy share_comments_read on public.share_comments for select
  using (org_id in (select public.auth_org_ids()));
create policy share_comments_insert on public.share_comments for insert
  with check (org_id in (select public.auth_org_ids()) and author_id = auth.uid());
create policy share_comments_update on public.share_comments for update
  using (
    org_id in (select public.auth_org_ids())
    and (
      author_id = auth.uid()
      or org_id in (select public.auth_editor_org_ids())
    )
  )
  with check (org_id in (select public.auth_org_ids()));

insert into storage.buckets (id, name, public) values ('share-snapshots', 'share-snapshots', false)
  on conflict (id) do nothing;

drop policy if exists "share-snapshots read own org" on storage.objects;
create policy "share-snapshots read own org" on storage.objects for select to authenticated
  using (bucket_id = 'share-snapshots' and (storage.foldername(name))[1] in (select o::text from public.auth_org_ids() o));

drop policy if exists "share-snapshots write own org editors" on storage.objects;
create policy "share-snapshots write own org editors" on storage.objects for insert to authenticated
  with check (bucket_id = 'share-snapshots' and (storage.foldername(name))[1] in (select o::text from public.auth_editor_org_ids() o));

commit;
