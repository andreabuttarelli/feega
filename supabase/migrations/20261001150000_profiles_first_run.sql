alter table public.profiles
  add column if not exists signup_campaign text,
  add column if not exists campaign_template_at timestamptz,
  add column if not exists onboarding_status text
    check (onboarding_status in ('active', 'dismissed', 'completed'));
