set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.brands
  add column if not exists palette jsonb not null default '[]'::jsonb,
  add column if not exists voice jsonb not null default '{}'::jsonb,
  add column if not exists logos jsonb not null default '[]'::jsonb;

alter table public.brands
  add constraint brands_palette_is_array check (jsonb_typeof(palette) = 'array'),
  add constraint brands_voice_is_object check (jsonb_typeof(voice) = 'object'),
  add constraint brands_logos_is_array check (jsonb_typeof(logos) = 'array');

create table if not exists public.brand_fonts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  role text not null check (role in ('heading', 'body', 'accent')),
  org_font_id uuid,
  google_family text check (google_family ~ '^[A-Za-z0-9][A-Za-z0-9 .''-]{0,63}$'),
  created_at timestamptz not null default now(),
  constraint brand_fonts_one_source check ((org_font_id is null) <> (google_family is null)),
  constraint brand_fonts_role_key unique (brand_id, role)
);

do $$
begin
  if to_regclass('public.org_fonts') is not null then
    alter table public.brand_fonts
      add constraint brand_fonts_org_font_fk foreign key (org_font_id) references public.org_fonts(id) on delete cascade;
  end if;
end $$;

alter table public.brand_fonts enable row level security;

create policy brand_fonts_read on public.brand_fonts
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

create policy brand_fonts_editor_write on public.brand_fonts
  for all to authenticated
  using (org_id in (select public.auth_editor_org_ids()))
  with check (org_id in (select public.auth_editor_org_ids()));

create table if not exists public.brand_pins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);

alter table public.brand_pins enable row level security;

create policy brand_pins_own on public.brand_pins
  for all to authenticated
  using (user_id = auth.uid() and org_id in (select public.auth_org_ids()))
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));

alter table public.assets
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists approved_at timestamptz;

create index if not exists assets_brand_approved on public.assets (brand_id, approved_at) where brand_id is not null;

alter table public.social_posts
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists social_posts_brand on public.social_posts (brand_id) where brand_id is not null;

update public.social_posts sp
set brand_id = sa.brand_id
from public.social_accounts sa
where sp.brand_id is null
  and sa.brand_id is not null
  and sa.org_id = sp.org_id
  and sa.platform = sp.platform
  and lower(sa.handle) = lower(sp.handle);

update public.brands b
set palette = coalesce(
  (select jsonb_agg(jsonb_build_object('hex', m.hex) order by m.first_at)
   from (
     select upper(r.h[1]) as hex, min(r.ord) as first_at
     from regexp_matches(b.content, '(#[0-9A-Fa-f]{6})\M', 'g') with ordinality as r(h, ord)
     group by upper(r.h[1])
   ) m),
  '[]'::jsonb)
where b.content is not null and b.palette = '[]'::jsonb;

update public.brands
set logos = jsonb_build_array(jsonb_build_object('variant', 'primary', 'url', logo_url))
where logo_url is not null and logos = '[]'::jsonb;
