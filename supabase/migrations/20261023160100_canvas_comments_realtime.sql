set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.canvas_comments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'canvas_comments'
  ) then
    alter publication supabase_realtime add table public.canvas_comments;
  end if;
end $$;
