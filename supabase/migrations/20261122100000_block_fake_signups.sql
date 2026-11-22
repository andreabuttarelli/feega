begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.blocked_email_domains (
  domain text primary key check (domain = lower(domain)),
  kind text not null check (kind in ('own', 'disposable')),
  created_at timestamptz not null default now()
);

create table if not exists public.allowed_email_domains (
  domain text primary key check (domain = lower(domain)),
  created_at timestamptz not null default now()
);

alter table public.blocked_email_domains enable row level security;
alter table public.allowed_email_domains enable row level security;

revoke all on public.blocked_email_domains from anon, authenticated;
revoke all on public.allowed_email_domains from anon, authenticated;

insert into public.blocked_email_domains (domain, kind) values
  ('ghoil.xyz', 'own'),
  ('abadabra.me', 'own'),
  ('kadal.me', 'own'),
  ('termanila.media', 'own'),
  ('kayou.site', 'own'),
  ('yugo.life', 'own'),
  ('agolos.live', 'own'),
  ('harsenpit.com', 'own')
on conflict (domain) do nothing;

insert into public.allowed_email_domains (domain) values
  ('gmail.com'),
  ('googlemail.com'),
  ('outlook.com'),
  ('hotmail.com'),
  ('live.com'),
  ('icloud.com'),
  ('me.com'),
  ('yahoo.com'),
  ('proton.me'),
  ('protonmail.com')
on conflict (domain) do nothing;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  burst_limit constant int := 5;
  burst_window constant interval := interval '10 minutes';
  blocked_message constant text := 'Please use a work or personal email address.';
  address text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
  email_domain text := substring(address from '@([^@]*)$');
  is_allowed boolean;
  is_blocked boolean;
  recent_signups int;
begin
  if email_domain is null or email_domain = '' then
    return '{}'::jsonb;
  end if;

  select exists (
    select 1 from public.allowed_email_domains a
    where email_domain = a.domain or right(email_domain, length(a.domain) + 1) = '.' || a.domain
  ) into is_allowed;

  if is_allowed then
    return '{}'::jsonb;
  end if;

  select exists (
    select 1 from public.blocked_email_domains b
    where email_domain = b.domain or right(email_domain, length(b.domain) + 1) = '.' || b.domain
  ) into is_blocked;

  if not is_blocked then
    select count(*) into recent_signups
    from auth.users u
    where u.created_at > now() - burst_window
      and lower(substring(u.email from '@([^@]*)$')) = email_domain;

    is_blocked := recent_signups >= burst_limit;
  end if;

  if is_blocked then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', blocked_message)
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

commit;
