drop policy if exists gallery_items_select on public.gallery_items;

create policy gallery_items_select_public on public.gallery_items
  for select to anon
  using (status in ('published', 'unlisted'));

create policy gallery_items_select on public.gallery_items
  for select to authenticated
  using (status in ('published', 'unlisted') or org_id in (select auth_org_ids()));
