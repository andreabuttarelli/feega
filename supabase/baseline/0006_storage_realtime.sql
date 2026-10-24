set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('brand-knowledge', 'brand-knowledge', false, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('canvas-assets', 'canvas-assets', false, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('embeds', 'embeds', true, 67108864, '{text/html}'::text[]) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('influencers', 'influencers', false, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('media', 'media', true, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('quarantine', 'quarantine', false, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('reference-images', 'reference-images', false, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('website', 'website', true, null, null) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "canvas members read realtime" on realtime.messages as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM canvases
  WHERE ((( SELECT realtime.topic() AS topic) = ('canvas:'::text || (canvases.id)::text)) AND (canvases.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "canvas members write realtime" on realtime.messages as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM canvases
  WHERE ((( SELECT realtime.topic() AS topic) = ('canvas:'::text || (canvases.id)::text)) AND (canvases.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "brand-knowledge delete own" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'brand-knowledge'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "brand-knowledge insert own" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'brand-knowledge'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "brand-knowledge read own" on storage.objects as permissive for select to authenticated using (((bucket_id = 'brand-knowledge'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "canvas-assets delete own org" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'canvas-assets'::text) AND ((storage.foldername(name))[1] IN ( SELECT (auth_org_ids())::text AS auth_org_ids))));
create policy "canvas-assets insert own org" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'canvas-assets'::text) AND ((storage.foldername(name))[1] IN ( SELECT (auth_org_ids())::text AS auth_org_ids))));
create policy "canvas-assets read own org" on storage.objects as permissive for select to authenticated using (((bucket_id = 'canvas-assets'::text) AND ((storage.foldername(name))[1] IN ( SELECT (auth_org_ids())::text AS auth_org_ids))));
create policy "embeds delete own org" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'embeds'::text) AND embed_node_writable(name)));
create policy "embeds insert own org" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'embeds'::text) AND embed_node_writable(name)));
create policy "embeds select own org" on storage.objects as permissive for select to authenticated using (((bucket_id = 'embeds'::text) AND embed_node_writable(name)));
create policy "embeds update own org" on storage.objects as permissive for update to authenticated using (((bucket_id = 'embeds'::text) AND embed_node_writable(name))) with check (((bucket_id = 'embeds'::text) AND embed_node_writable(name)));
create policy "influencers delete own org" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'influencers'::text) AND ((storage.foldername(name))[1] <> 'catalogue'::text) AND (
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "influencers read catalogue" on storage.objects as permissive for select to authenticated using (((bucket_id = 'influencers'::text) AND ((storage.foldername(name))[1] = 'catalogue'::text)));
create policy "influencers read own org" on storage.objects as permissive for select to authenticated using (((bucket_id = 'influencers'::text) AND ((storage.foldername(name))[1] <> 'catalogue'::text) AND (
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "influencers write own org" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'influencers'::text) AND ((storage.foldername(name))[1] <> 'catalogue'::text) AND (
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "media delete gallery" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'gallery'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT g.id
   FROM gallery_items g
  WHERE (g.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "media delete own" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "media delete own brand" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] <> 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END IN ( SELECT brands.id
   FROM brands
  WHERE (brands.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "media delete own colour" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "media insert gallery" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'gallery'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT g.id
   FROM gallery_items g
  WHERE (g.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "media insert own" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "media insert own brand" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] <> 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[1])::uuid
    ELSE NULL::uuid
END IN ( SELECT brands.id
   FROM brands
  WHERE (brands.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "media insert own colour" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "media select gallery" on storage.objects as permissive for select to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'gallery'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT g.id
   FROM gallery_items g
  WHERE (g.org_id IN ( SELECT auth_org_ids() AS auth_org_ids))))));
create policy "media select own colour" on storage.objects as permissive for select to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "media update own colour" on storage.objects as permissive for update to authenticated using (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids)))) with check (((bucket_id = 'media'::text) AND ((storage.foldername(name))[1] = 'colours'::text) AND (
CASE
    WHEN ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) THEN ((storage.foldername(name))[2])::uuid
    ELSE NULL::uuid
END IN ( SELECT auth_org_ids() AS auth_org_ids))));
create policy "org files editors delete" on storage.objects as restrictive for delete to authenticated using (storage_write_allowed(bucket_id, name));
create policy "org files editors insert" on storage.objects as restrictive for insert to authenticated with check (storage_write_allowed(bucket_id, name));
create policy "org files editors update" on storage.objects as restrictive for update to authenticated using (storage_write_allowed(bucket_id, name)) with check (storage_write_allowed(bucket_id, name));
create policy "reference-images read catalogue" on storage.objects as permissive for select to authenticated using (((bucket_id = 'reference-images'::text) AND ((storage.foldername(name))[1] = 'catalogue'::text)));

do $$
begin
  alter publication supabase_realtime add table only public.canvas_comments;
  alter publication supabase_realtime add table only public.canvases;
  alter publication supabase_realtime add table only public.node_runs;
  alter publication supabase_realtime add table only public.nodes;
  alter publication supabase_realtime add table only public.nodes_connections;
  alter publication supabase_realtime add table only public.product_batch_items;
exception when undefined_object or duplicate_object then
  raise notice 'supabase_realtime publication unavailable or already set: %', sqlerrm;
end
$$;

alter table public.canvas_comments replica identity full;
alter table public.canvases replica identity full;
alter table public.node_runs replica identity full;
alter table public.nodes replica identity full;
alter table public.nodes_connections replica identity full;
alter table public.product_batch_items replica identity full;
