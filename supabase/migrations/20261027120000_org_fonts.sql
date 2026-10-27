set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.org_fonts (
  id uuid primary key references public.assets(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  family text not null check (family ~ '^[A-Za-z0-9][A-Za-z0-9 .''-]{0,63}$'),
  weight integer not null default 400 check (weight between 1 and 1000),
  style text not null default 'normal' check (style in ('normal', 'italic')),
  path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists org_fonts_org_family on public.org_fonts (org_id, family);

alter table public.org_fonts enable row level security;

create policy org_fonts_read on public.org_fonts
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

create policy org_fonts_editor_write on public.org_fonts
  for all to authenticated
  using (org_id in (select public.auth_editor_org_ids()))
  with check (org_id in (select public.auth_editor_org_ids()));

insert into public.org_fonts (id, org_id, family, weight, style, path, created_at)
select
  a.id,
  a.org_id,
  a.content::jsonb ->> 'family',
  coalesce((a.content::jsonb ->> 'weight')::integer, 400),
  case when (a.content::jsonb ->> 'italic')::boolean then 'italic' else 'normal' end,
  a.url,
  a.created_at
from public.assets a
where a.type = 'document'
  and a.mime_type in ('font/woff2', 'font/woff', 'font/ttf', 'font/otf')
  and a.url is not null
  and a.content is not null
  and a.content ~ '^\s*\{'
  and (a.content::jsonb ->> 'family') ~ '^[A-Za-z0-9][A-Za-z0-9 .''-]{0,63}$'
on conflict (id) do nothing;
