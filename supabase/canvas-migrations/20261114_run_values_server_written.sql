begin;

create or replace function public.node_runs_keep_server_values() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  server_keys constant text[] := array['quotedUsd'];
  kept jsonb := '{}'::jsonb;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.params is not null then
    select coalesce(jsonb_object_agg(k, old.params -> k), '{}'::jsonb) into kept
    from unnest(server_keys) k
    where old.params ? k;
  end if;

  if new.params is null and kept = '{}'::jsonb then
    return new;
  end if;

  new.params := (coalesce(new.params, '{}'::jsonb) - server_keys) || kept;
  return new;
end;
$$;

revoke all on function public.node_runs_keep_server_values() from public, anon, authenticated;

drop trigger if exists node_runs_keep_server_values on public.node_runs;
create trigger node_runs_keep_server_values
  before insert or update on public.node_runs
  for each row execute function public.node_runs_keep_server_values();

commit;
