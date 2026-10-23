set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.canvas_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  node_id uuid references public.nodes(id) on delete cascade,
  parent_id uuid references public.canvas_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  x double precision not null default 0,
  y double precision not null default 0,
  body text not null check (char_length(body) between 1 and 2000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists canvas_comments_canvas_idx on public.canvas_comments (canvas_id) where deleted_at is null;
create index if not exists canvas_comments_org_idx on public.canvas_comments (org_id);
create index if not exists canvas_comments_node_idx on public.canvas_comments (node_id);
create index if not exists canvas_comments_parent_idx on public.canvas_comments (parent_id);
create index if not exists canvas_comments_author_idx on public.canvas_comments (author_id);

alter table public.canvas_comments enable row level security;

create policy comments_read on public.canvas_comments for select
  using (org_id in (select public.auth_org_ids()));
create policy comments_insert on public.canvas_comments for insert
  with check (org_id in (select public.auth_org_ids()) and author_id = auth.uid());
create policy comments_update on public.canvas_comments for update
  using (org_id in (select public.auth_org_ids()) and (author_id = auth.uid() or org_id in (select public.auth_editor_org_ids())))
  with check (org_id in (select public.auth_org_ids()));
