begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

update public.nodes n
set type = 'motion',
    data = m.legacy_data || (n.data - 'kind'),
    deleted_at = case when m.emptied then null else n.deleted_at end
from public.element_node_migration m
where n.id = m.node_id;

drop table public.element_node_migration;

delete from public.app_schema_migrations where filename = '20261023130000_element_node_rows.sql';

commit;
