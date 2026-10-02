alter table public.node_runs
  add column if not exists provider_purged_at timestamptz;

create index if not exists node_runs_provider_unpurged_idx
  on public.node_runs (finished_at desc)
  where provider_purged_at is null and external_job_id is not null;
