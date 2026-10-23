begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table if not exists public.element_node_migration (
  node_id uuid primary key,
  org_id uuid not null,
  legacy_data jsonb not null,
  emptied boolean not null,
  migrated_at timestamptz not null default now()
);

alter table public.element_node_migration enable row level security;

insert into public.element_node_migration (node_id, org_id, legacy_data, emptied)
select
  n.id,
  n.org_id,
  n.data,
  not exists (
    select 1
    from jsonb_array_elements(coalesce(head.doc -> 'tracks', '[]'::jsonb)) as track,
         jsonb_array_elements(coalesce(track -> 'clips', '[]'::jsonb)) as clip
  )
from public.nodes n
left join lateral (
  select r.doc
  from public.motion_revisions r
  where r.node_id = n.id
  order by r.version desc
  limit 1
) head on true
where n.type = 'motion'
  and n.data ->> 'kind' in ('element', 'group')
  and n.deleted_at is null
on conflict (node_id) do nothing;

update public.nodes n
set type = 'element',
    data = jsonb_strip_nulls(jsonb_build_object(
      'docHeadRevision', coalesce(m.legacy_data -> 'docHeadRevision', '0'::jsonb),
      'posterRevision', m.legacy_data -> 'posterRevision',
      'interactive', m.legacy_data -> 'interactive',
      'kind', case when m.legacy_data ->> 'kind' = 'group' then '"group"'::jsonb end,
      'rotation', m.legacy_data -> 'rotation',
      'groupId', m.legacy_data -> 'groupId'
    ))
from public.element_node_migration m
where n.id = m.node_id
  and n.type = 'motion';

update public.nodes n
set deleted_at = now()
from public.element_node_migration m
where n.id = m.node_id
  and m.emptied
  and n.deleted_at is null;

commit;
