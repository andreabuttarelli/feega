begin;

create or replace function public.asset_path_in_reach(p_org uuid, p_path text) returns boolean
language sql
stable
set search_path = ''
as $$
  select p_path is null
    or p_path ~ '^https?://'
    or split_part(p_path, '/', 1) in (p_org::text, coalesce(auth.uid()::text, ''))
    or exists (select 1 from public.assets a where a.org_id = p_org and (a.url = p_path or a.proxy_url = p_path));
$$;

revoke all on function public.asset_path_in_reach(uuid, text) from public, anon;

create or replace function public.assets_path_in_reach() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.url is distinct from old.url) and not public.asset_path_in_reach(new.org_id, new.url) then
    raise exception 'asset_path_out_of_reach' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.proxy_url is distinct from old.proxy_url) and not public.asset_path_in_reach(new.org_id, new.proxy_url) then
    raise exception 'asset_path_out_of_reach' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.assets_path_in_reach() from public, anon, authenticated;

drop trigger if exists assets_path_in_reach on public.assets;
create trigger assets_path_in_reach
  before insert or update of url, proxy_url on public.assets
  for each row execute function public.assets_path_in_reach();

commit;
