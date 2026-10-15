alter table public.canvases add column if not exists last_edited_at timestamptz not null default now();
alter table public.projects add column if not exists last_edited_at timestamptz not null default now();

update public.canvases c
set last_edited_at = greatest(
  c.updated_at,
  coalesce((select max(n.updated_at) from public.nodes n where n.canvas_id = c.id), c.updated_at),
  coalesce((select max(r.created_at) from public.motion_revisions r join public.nodes n on n.id = r.node_id where n.canvas_id = c.id), c.updated_at)
);

update public.projects p
set last_edited_at = greatest(
  p.updated_at,
  coalesce((select max(c.last_edited_at) from public.canvases c where c.project_id = p.id), p.updated_at)
);

create index if not exists canvases_org_last_edited_idx on public.canvases (org_id, last_edited_at desc) where deleted_at is null;
create index if not exists projects_org_last_edited_idx on public.projects (org_id, last_edited_at desc) where archived_at is null;

create or replace function public.touch_last_edited(p_canvas_id uuid, p_project_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.canvases set last_edited_at = now()
  where id = p_canvas_id and last_edited_at < now() - interval '30 seconds';
  update public.projects set last_edited_at = now()
  where id = p_project_id and last_edited_at < now() - interval '30 seconds';
$$;

revoke all on function public.touch_last_edited(uuid, uuid) from public, anon, authenticated;

create or replace function public.nodes_touch_last_edited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.touch_last_edited(new.canvas_id, new.project_id);
  return null;
end;
$$;

create or replace function public.motion_revisions_touch_last_edited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.touch_last_edited(n.canvas_id, n.project_id) from public.nodes n where n.id = new.node_id;
  return null;
end;
$$;

drop trigger if exists nodes_touch_last_edited on public.nodes;
create trigger nodes_touch_last_edited
after insert or update on public.nodes
for each row execute function public.nodes_touch_last_edited();

drop trigger if exists motion_revisions_touch_last_edited on public.motion_revisions;
create trigger motion_revisions_touch_last_edited
after insert on public.motion_revisions
for each row execute function public.motion_revisions_touch_last_edited();
