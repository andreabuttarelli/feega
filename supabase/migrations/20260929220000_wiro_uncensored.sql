begin;

alter table public.ai_models
  add column if not exists uncensored boolean not null default false,
  add column if not exists wire_spec jsonb not null default '{}'::jsonb;

alter table public.assets
  add column if not exists uncensored boolean not null default false;

alter table public.ai_calls
  add column if not exists uncensored boolean not null default false;

alter table public.influencers
  add column if not exists adult_persona_at timestamptz;

create table if not exists public.org_uncensored_optins (
  org_id          uuid primary key references public.orgs(id) on delete cascade,
  enabled_by      uuid not null references public.profiles(id),
  enabled_at      timestamptz not null default now(),
  attested_adult  boolean not null check (attested_adult),
  policy_version  text not null,
  disabled_at     timestamptz,
  disabled_by     uuid references public.profiles(id)
);

alter table public.org_uncensored_optins enable row level security;

drop policy if exists "optins read own org" on public.org_uncensored_optins;
create policy "optins read own org" on public.org_uncensored_optins
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

drop policy if exists "optins written by owner" on public.org_uncensored_optins;
create policy "optins written by owner" on public.org_uncensored_optins
  for all to authenticated
  using (exists (
    select 1 from public.orgs_members m
    where m.org_id = org_uncensored_optins.org_id and m.user_id = auth.uid() and m.role = 'owner'
  ))
  with check (exists (
    select 1 from public.orgs_members m
    where m.org_id = org_uncensored_optins.org_id and m.user_id = auth.uid() and m.role = 'owner'
  ));

create table if not exists public.moderation_checks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  node_id        uuid,
  model          text,
  uncensored     boolean not null default false,
  stage          text not null check (stage in ('rules', 'jev', 'llm')),
  verdict        text not null check (verdict in ('clear', 'escalate', 'refuse')),
  category       text,
  probabilities  jsonb not null default '{}'::jsonb,
  reason         text,
  actor_kind     text not null default 'user' check (actor_kind in ('user', 'agent', 'system')),
  actor_id       uuid,
  created_at     timestamptz not null default now()
);

create index if not exists moderation_checks_org_idx on public.moderation_checks (org_id, created_at desc);

alter table public.moderation_checks enable row level security;

drop policy if exists "moderation_checks own org" on public.moderation_checks;
create policy "moderation_checks own org" on public.moderation_checks
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

commit;
