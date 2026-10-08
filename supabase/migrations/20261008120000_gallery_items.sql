begin;

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 60),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  kind text not null check (kind in ('motion', 'composition')),
  format text not null check (format in ('16:9', '9:16', '1:1', '4:5', '1:1 1440')),
  duration_s numeric not null check (duration_s > 0),
  doc jsonb not null,
  assets jsonb not null default '[]'::jsonb check (jsonb_typeof(assets) = 'array'),
  poster_url text,
  preview_url text,
  source_node_id uuid references public.nodes(id) on delete set null,
  remixed_from uuid references public.gallery_items(id) on delete set null,
  remix_count integer not null default 0 check (remix_count >= 0),
  status text not null default 'unlisted' check (status in ('published', 'unlisted', 'removed')),
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id uuid,
  agent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists gallery_items_published_idx on public.gallery_items (published_at desc) where status = 'published';
create index if not exists gallery_items_org_idx on public.gallery_items (org_id, created_at desc);
create index if not exists gallery_items_source_node_idx on public.gallery_items (source_node_id) where source_node_id is not null;
create index if not exists gallery_items_tags_idx on public.gallery_items using gin (tags);

alter table public.gallery_items enable row level security;

drop policy if exists gallery_items_select on public.gallery_items;
create policy gallery_items_select on public.gallery_items
  for select to anon, authenticated
  using (status in ('published', 'unlisted') or org_id in (select public.auth_org_ids()));

drop policy if exists gallery_items_insert on public.gallery_items;
create policy gallery_items_insert on public.gallery_items
  for insert to authenticated
  with check (org_id in (select public.auth_org_ids()) and user_id = auth.uid() and remix_count = 0);

drop policy if exists gallery_items_update on public.gallery_items;
create policy gallery_items_update on public.gallery_items
  for update to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

revoke all on public.gallery_items from anon, authenticated;
grant select on public.gallery_items to anon, authenticated;
grant insert on public.gallery_items to authenticated;
grant update (title, description, tags, status, doc, assets, poster_url, preview_url, updated_at, published_at) on public.gallery_items to authenticated;

create table if not exists public.gallery_remixes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  item_id uuid references public.gallery_items(id) on delete set null,
  node_id uuid not null references public.nodes(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id uuid,
  agent_key text,
  created_at timestamptz not null default now(),
  unique (node_id)
);

create index if not exists gallery_remixes_item_idx on public.gallery_remixes (item_id);

alter table public.gallery_remixes enable row level security;

drop policy if exists gallery_remixes_select on public.gallery_remixes;
create policy gallery_remixes_select on public.gallery_remixes
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

drop policy if exists gallery_remixes_insert on public.gallery_remixes;
create policy gallery_remixes_insert on public.gallery_remixes
  for insert to authenticated
  with check (
    org_id in (select public.auth_org_ids())
    and exists (select 1 from public.nodes n where n.id = node_id and n.org_id = gallery_remixes.org_id and n.type = 'motion')
    and exists (select 1 from public.gallery_items g where g.id = item_id and g.status in ('published', 'unlisted'))
  );

revoke all on public.gallery_remixes from anon, authenticated;
grant select, insert on public.gallery_remixes to authenticated;

create or replace function public.gallery_count_remix()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gallery_items set remix_count = remix_count + 1 where id = new.item_id;
  return new;
end;
$$;

revoke execute on function public.gallery_count_remix() from public, anon, authenticated;

drop trigger if exists gallery_remixes_count on public.gallery_remixes;
create trigger gallery_remixes_count
  after insert on public.gallery_remixes
  for each row execute function public.gallery_count_remix();

insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists "media insert gallery" on storage.objects;
create policy "media insert gallery" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (storage.foldername(name))[2]::uuid end)
      in (select g.id from public.gallery_items g where g.org_id in (select public.auth_org_ids()))
  );

drop policy if exists "media delete gallery" on storage.objects;
create policy "media delete gallery" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (storage.foldername(name))[2]::uuid end)
      in (select g.id from public.gallery_items g where g.org_id in (select public.auth_org_ids()))
  );

drop policy if exists "media select gallery" on storage.objects;
create policy "media select gallery" on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (case when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (storage.foldername(name))[2]::uuid end)
      in (select g.id from public.gallery_items g where g.org_id in (select public.auth_org_ids()))
  );

commit;
