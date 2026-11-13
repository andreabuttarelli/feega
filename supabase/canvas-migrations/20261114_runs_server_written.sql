begin;

grant execute on function public.auth_org_ids() to authenticated, service_role;
grant execute on function public.auth_editor_org_ids() to authenticated, service_role;

revoke insert, update, delete, truncate, references, trigger on public.node_runs from anon, authenticated;
drop policy if exists org_insert on public.node_runs;
drop policy if exists org_update on public.node_runs;
drop policy if exists org_delete on public.node_runs;
drop policy if exists editors_insert on public.node_runs;
drop policy if exists editors_update on public.node_runs;
drop policy if exists editors_delete on public.node_runs;

alter table public.node_runs drop constraint if exists node_runs_params_object;
alter table public.node_runs add constraint node_runs_params_object
  check (params is null or jsonb_typeof(params) = 'object') not valid;

commit;
