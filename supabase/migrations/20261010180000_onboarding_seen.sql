alter table public.profiles add column if not exists onboarding_seen_at timestamptz;

update public.profiles set onboarding_seen_at = now() where onboarding_seen_at is null;
