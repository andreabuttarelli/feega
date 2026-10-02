create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete set null,
  canvas_id uuid references public.canvases(id) on delete set null,
  node_id uuid references public.nodes(id) on delete set null,
  share_token text,
  target_url text not null,
  affected_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('illegal', 'copyright', 'likeness', 'csam')),
  priority smallint not null,
  details jsonb not null default '{}'::jsonb,
  reporter_name text,
  reporter_email text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_fingerprint text not null,
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'actioned', 'counter_noticed', 'restored')),
  decision text check (decision in ('dismiss', 'remove', 'suspend', 'restore')),
  ground text,
  decision_note text,
  automated boolean not null default false,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  removed_share_token text,
  counter_token_hash text,
  counter_notice jsonb,
  counter_noticed_at timestamptz,
  restore_after timestamptz,
  suit_filed_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_reports_queue_idx on public.content_reports (status, priority, created_at);
create index if not exists content_reports_fingerprint_idx on public.content_reports (reporter_fingerprint, created_at desc);
create index if not exists content_reports_restore_idx on public.content_reports (restore_after)
  where status = 'counter_noticed' and suit_filed_at is null;

create table if not exists public.account_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete set null,
  report_id uuid not null references public.content_reports(id) on delete cascade,
  reason text not null,
  weight smallint not null check (weight > 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_strikes_user_idx on public.account_strikes (user_id) where revoked_at is null;

alter table public.content_reports enable row level security;
alter table public.account_strikes enable row level security;

revoke all on public.content_reports from anon, authenticated;
revoke all on public.account_strikes from anon, authenticated;
