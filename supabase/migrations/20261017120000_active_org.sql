set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.profiles
  add column if not exists active_org_id uuid references public.orgs(id) on delete set null;
