create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  canvas_id uuid references public.canvases(id) on delete set null,
  products_node_id uuid references public.nodes(id) on delete set null,
  name text not null,
  model text not null,
  preview_model text not null,
  status text not null default 'draft' check (status in ('draft', 'running', 'done', 'cancelled')),
  spec jsonb not null default '{}'::jsonb,
  actor_kind text not null default 'user',
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_batches_project_idx on public.product_batches (org_id, project_id, created_at desc);

create table if not exists public.product_batch_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  batch_id uuid not null references public.product_batches(id) on delete cascade,
  gen_node_id uuid references public.nodes(id) on delete set null,
  product_index integer not null check (product_index >= 1),
  product_title text not null,
  influencer_id uuid references public.influencers(id) on delete set null,
  environment text not null,
  shot text not null,
  variation integer not null check (variation >= 1),
  preview boolean not null default false,
  model text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'blocked', 'cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  asset_id uuid references public.assets(id) on delete set null,
  node_run_id uuid references public.node_runs(id) on delete set null,
  approval text not null default 'pending' check (approval in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_batch_items_batch_idx on public.product_batch_items (batch_id, created_at);
create index if not exists product_batch_items_queue_idx on public.product_batch_items (status, next_attempt_at)
  where status = 'queued';

alter table public.product_batches enable row level security;
alter table public.product_batch_items enable row level security;

create policy product_batches_org on public.product_batches for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create policy product_batch_items_org on public.product_batch_items for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

alter table public.product_batch_items replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_batch_items'
  ) then
    alter publication supabase_realtime add table public.product_batch_items;
  end if;
end $$;
