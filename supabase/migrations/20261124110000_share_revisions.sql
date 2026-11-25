begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.share_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.share_sessions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  number integer not null check (number > 0),
  author_id uuid not null references auth.users (id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 2000),
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, number)
);

create table if not exists public.share_verdicts (
  revision_id uuid not null references public.share_revisions (id) on delete cascade,
  session_id text not null references public.share_sessions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reviewer_name text not null,
  verdict text not null check (verdict in ('approved', 'changes_requested')),
  note text check (note is null or char_length(note) <= 2000),
  decided_at timestamptz not null default now(),
  primary key (revision_id, reviewer_id)
);

alter table public.share_comments
  add column if not exists revision_id uuid references public.share_revisions (id) on delete set null;

create index if not exists share_revisions_session_idx on public.share_revisions (session_id, number);
create index if not exists share_revisions_org_idx on public.share_revisions (org_id);
create index if not exists share_revisions_author_idx on public.share_revisions (author_id);
create index if not exists share_verdicts_session_idx on public.share_verdicts (session_id);
create index if not exists share_verdicts_org_idx on public.share_verdicts (org_id);
create index if not exists share_verdicts_reviewer_idx on public.share_verdicts (reviewer_id);
create index if not exists share_comments_revision_idx on public.share_comments (revision_id);

alter table public.share_revisions enable row level security;
alter table public.share_verdicts enable row level security;

create policy share_revisions_read on public.share_revisions for select
  using (org_id in (select public.auth_org_ids()));
create policy share_revisions_insert on public.share_revisions for insert
  with check (
    org_id in (select public.auth_editor_org_ids())
    and author_id = auth.uid()
    and exists (select 1 from public.share_sessions s where s.id = session_id and s.org_id = org_id and s.host_user_id = auth.uid())
  );

create policy share_verdicts_read on public.share_verdicts for select
  using (org_id in (select public.auth_org_ids()));
create policy share_verdicts_insert on public.share_verdicts for insert
  with check (org_id in (select public.auth_org_ids()) and reviewer_id = auth.uid());
create policy share_verdicts_update on public.share_verdicts for update
  using (reviewer_id = auth.uid() and org_id in (select public.auth_org_ids()))
  with check (reviewer_id = auth.uid() and org_id in (select public.auth_org_ids()));

commit;
