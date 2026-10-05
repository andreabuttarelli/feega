create table if not exists public.custom_voices (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id) on delete cascade,
  provider_voice_id   text not null unique,
  name                text not null check (length(name) between 1 and 100),
  method              text not null check (method in ('design', 'instant_clone')),
  description         text,
  preview_url         text,
  consent_basis       text check (consent_basis in ('own_voice', 'consented_speaker')),
  consent_speaker     text,
  consent_attested_at timestamptz,
  samples_purged_at   timestamptz,
  actor_kind          text not null default 'user' check (actor_kind in ('user', 'agent', 'system')),
  actor_id            uuid references public.profiles(id) on delete set null,
  agent_key           text,
  created_at          timestamptz not null default now(),
  constraint custom_voices_clone_needs_consent check (
    method <> 'instant_clone'
    or (consent_basis is not null and consent_attested_at is not null
        and (consent_basis = 'own_voice' or length(trim(coalesce(consent_speaker, ''))) > 0))
  )
);

create index if not exists custom_voices_org_idx on public.custom_voices (org_id, created_at desc);

alter table public.custom_voices enable row level security;

drop policy if exists "custom_voices own org" on public.custom_voices;
create policy "custom_voices own org" on public.custom_voices
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

create or replace function public.voice_owned_elsewhere(p_voice text, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.custom_voices
    where provider_voice_id = p_voice and org_id <> p_org
  );
$$;

revoke all on function public.voice_owned_elsewhere(text, uuid) from public;
grant execute on function public.voice_owned_elsewhere(text, uuid) to authenticated, service_role;
