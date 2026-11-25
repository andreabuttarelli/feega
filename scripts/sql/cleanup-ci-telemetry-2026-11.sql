with idle_us_npx_installs as (
  select install_id
  from public.usage_events
  group by install_id
  having bool_and(editor = 'npx')
    and bool_and(country = 'US')
    and bool_and(created_at >= '2026-11-22 18:00+00' and created_at < '2026-11-23 00:00+00')
    and coalesce(max(edit_count), 0) = 0
    and count(*) filter (where event = 'edit') = 0
)
select
  count(*) filter (where ext_version !~ '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$') as bad_version_rows,
  count(*) filter (where install_id in (select install_id from idle_us_npx_installs)) as ci_install_rows,
  count(*) filter (
    where ext_version !~ '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
      or install_id in (select install_id from idle_us_npx_installs)
  ) as rows_to_delete,
  count(*) as total_rows
from public.usage_events;

-- begin;
--
-- delete from public.usage_events
-- where ext_version !~ '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
--    or install_id in (
--      select install_id
--      from public.usage_events
--      group by install_id
--      having bool_and(editor = 'npx')
--        and bool_and(country = 'US')
--        and bool_and(created_at >= '2026-11-22 18:00+00' and created_at < '2026-11-23 00:00+00')
--        and coalesce(max(edit_count), 0) = 0
--        and count(*) filter (where event = 'edit') = 0
--    );
--
-- commit;
