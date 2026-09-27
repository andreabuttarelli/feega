begin;

create table if not exists public.reference_images (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.orgs(id) on delete cascade,
  name         text not null,
  storage_path text not null unique,
  mime_type    text,
  width        integer,
  height       integer,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists reference_images_org_idx on public.reference_images (org_id, sort_order);

alter table public.reference_images enable row level security;

drop policy if exists "reference_images read catalogue or own org" on public.reference_images;
create policy "reference_images read catalogue or own org" on public.reference_images
  for select to authenticated
  using (org_id is null or org_id in (select public.auth_org_ids()));

insert into storage.buckets (id, name, public) values ('reference-images', 'reference-images', false)
  on conflict (id) do nothing;

drop policy if exists "reference-images read catalogue" on storage.objects;
create policy "reference-images read catalogue" on storage.objects for select to authenticated
  using (bucket_id = 'reference-images' and (storage.foldername(name))[1] = 'catalogue');

commit;
