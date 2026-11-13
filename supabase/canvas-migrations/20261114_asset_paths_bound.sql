begin;

create or replace function public.assets_path_in_reach() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or new.url is null or new.url ~ '^https?://' then
    return new;
  end if;
  if split_part(new.url, '/', 1) in (new.org_id::text, coalesce(auth.uid()::text, '')) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.url = old.url then
    return new;
  end if;
  if exists (select 1 from public.assets a where a.org_id = new.org_id and a.url = new.url) then
    return new;
  end if;
  raise exception 'asset_path_out_of_reach' using errcode = '42501';
end;
$$;

revoke all on function public.assets_path_in_reach() from public, anon, authenticated;

drop trigger if exists assets_path_in_reach on public.assets;
create trigger assets_path_in_reach
  before insert or update of url on public.assets
  for each row execute function public.assets_path_in_reach();

commit;
