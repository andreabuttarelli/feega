begin;

alter table canvases add column if not exists deleted_at timestamptz;
create index if not exists canvases_live_idx on canvases(project_id) where deleted_at is null;

commit;
