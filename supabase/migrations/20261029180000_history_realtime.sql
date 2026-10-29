set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.canvas_versions replica identity full;
alter table public.canvas_conflicts replica identity full;
alter table public.motion_revisions replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['canvas_events', 'canvas_versions', 'canvas_conflicts', 'motion_revisions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
