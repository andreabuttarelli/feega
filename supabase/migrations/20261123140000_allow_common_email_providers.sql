begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.allowed_email_domains (domain) values
  ('hotmail.it'), ('hotmail.fr'), ('hotmail.es'), ('hotmail.de'), ('hotmail.co.uk'),
  ('outlook.it'), ('outlook.fr'), ('outlook.es'), ('outlook.de'), ('msn.com'), ('live.it'),
  ('yahoo.it'), ('yahoo.fr'), ('yahoo.es'), ('yahoo.de'), ('yahoo.co.uk'), ('yahoo.co.jp'), ('ymail.com'),
  ('libero.it'), ('virgilio.it'), ('tiscali.it'), ('alice.it'), ('tim.it'), ('fastwebnet.it'), ('email.it'), ('inwind.it'), ('pec.it'),
  ('aol.com'), ('gmx.com'), ('gmx.de'), ('gmx.net'), ('gmx.at'), ('web.de'), ('t-online.de'),
  ('orange.fr'), ('free.fr'), ('laposte.net'), ('sfr.fr'),
  ('fastmail.com'), ('hey.com'), ('zoho.com'), ('tutanota.com'), ('tuta.io'), ('pm.me'), ('mail.com'),
  ('yandex.com'), ('yandex.ru'), ('mail.ru'),
  ('qq.com'), ('163.com'), ('126.com'), ('naver.com'), ('daum.net'),
  ('comcast.net'), ('verizon.net'), ('att.net'), ('sbcglobal.net'),
  ('mac.com'), ('rocketmail.com')
on conflict (domain) do nothing;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  burst_limit constant int := 20;
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
$function$;

commit;
