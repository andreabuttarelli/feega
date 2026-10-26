create schema if not exists extensions;
set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema extensions;

do $$
begin
  create extension if not exists pg_jsonschema with schema extensions;
exception when others then
  raise notice 'pg_jsonschema unavailable (%): jsonb schema checks are skipped', sqlerrm;
end
$$;

create type public.project_mode as enum ('standard', 'uncensored');
create sequence public.canvas_events_id_seq;
