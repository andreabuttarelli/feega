alter table public.user_age_verifications
  add column if not exists provider_session_id text;

create unique index if not exists user_age_verifications_provider_session_key
  on public.user_age_verifications (provider_session_id);
