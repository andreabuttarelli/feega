begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists motion_revisions_insert on public.motion_revisions;

create policy motion_revisions_insert on public.motion_revisions
  for insert with check (
    org_id in (select auth_org_ids())
    and exists (
      select 1 from public.nodes n
      where n.id = node_id
        and n.org_id = motion_revisions.org_id
        and n.type in ('motion', 'element')
    )
  );

commit;
