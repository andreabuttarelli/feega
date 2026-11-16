begin;

alter table public.credit_ledger add column if not exists call_key text;
alter table public.ai_calls add column if not exists hold_key text;

create unique index if not exists credit_ledger_call_key_idx
  on public.credit_ledger (call_key, kind) where call_key is not null;

create unique index if not exists credit_ledger_ai_call_debit_idx
  on public.credit_ledger (ai_call_id) where kind = 'debit' and ai_call_id is not null;

create index if not exists credit_ledger_open_holds_idx
  on public.credit_ledger (created_at) where call_key is not null and kind = 'debit';

create or replace function public.lock_org_credits(_org_id uuid) returns void
  language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('credits:' || _org_id::text, 0));
$$;

create or replace function public.credit_gate(_org_id uuid) returns integer
  language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when kind = 'grant' then amount else -amount end), 0)::integer
  from public.credit_ledger
  where org_id = _org_id;
$$;

create or replace function public.credit_hold(_org_id uuid, _keys text[], _amounts integer[]) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  _wanted integer;
begin
  if coalesce(array_length(_keys, 1), 0) = 0 or array_length(_keys, 1) is distinct from array_length(_amounts, 1) then
    raise exception 'credit_hold needs one amount per key';
  end if;
  if exists (select 1 from unnest(_amounts) a where a is null or a <= 0) then
    raise exception 'credit_hold amounts must be positive';
  end if;

  perform public.lock_org_credits(_org_id);

  select coalesce(sum(h.amount), 0) into _wanted
  from unnest(_keys, _amounts) as h(key, amount)
  where not exists (select 1 from public.credit_ledger l where l.call_key = h.key and l.kind = 'debit');

  if _wanted = 0 then
    return true;
  end if;
  if public.credit_gate(_org_id) < _wanted then
    return false;
  end if;

  insert into public.credit_ledger (org_id, kind, source, amount, note, call_key)
  select _org_id, 'debit', 'ai_usage', h.amount, h.key, h.key
  from unnest(_keys, _amounts) as h(key, amount)
  where not exists (select 1 from public.credit_ledger l where l.call_key = h.key and l.kind = 'debit');

  return true;
end; $$;

create or replace function public.credit_release(_org_id uuid, _key text) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  _held integer;
begin
  perform public.lock_org_credits(_org_id);

  select amount into _held
  from public.credit_ledger
  where org_id = _org_id and kind = 'debit'
    and (call_key = _key or (call_key is null and note = _key and source = 'ai_usage'))
  limit 1;
  if _held is null then
    return 0;
  end if;

  if exists (
    select 1 from public.credit_ledger
    where org_id = _org_id and kind = 'grant'
      and (call_key = _key or (call_key is null and note = _key and source = 'refund'))
  ) then
    return _held;
  end if;

  insert into public.credit_ledger (org_id, kind, source, amount, note, call_key)
  values (_org_id, 'grant', 'refund', _held, _key, _key);
  return _held;
end; $$;

create or replace function public.credit_release_stale(_older_than interval) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  _hold record;
  _released integer := 0;
begin
  for _hold in
    select h.org_id, h.call_key
    from public.credit_ledger h
    where h.kind = 'debit' and h.call_key is not null and h.created_at < now() - _older_than
      and not exists (select 1 from public.credit_ledger r where r.call_key = h.call_key and r.kind = 'grant')
      and not exists (select 1 from public.ai_calls c where c.hold_key = h.call_key)
  loop
    perform public.credit_release(_hold.org_id, _hold.call_key);
    _released := _released + 1;
  end loop;
  return _released;
end; $$;

create or replace function public.debit_ai_call() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  _credits integer := ceil(coalesce(NEW.billed_credits, 0))::integer;
begin
  if NEW.hold_key is not null then
    perform public.credit_release(NEW.org_id, NEW.hold_key);
  end if;
  if _credits <= 0 then
    return NEW;
  end if;

  perform public.lock_org_credits(NEW.org_id);
  insert into public.credit_ledger (org_id, kind, source, amount, ai_call_id)
  values (NEW.org_id, 'debit', 'ai_usage', _credits, NEW.id);
  return NEW;
end; $$;

drop trigger if exists ai_calls_debit on public.ai_calls;
create trigger ai_calls_debit after insert on public.ai_calls
  for each row execute function public.debit_ai_call();

revoke execute on function public.lock_org_credits(uuid) from public, anon, authenticated;
revoke execute on function public.credit_gate(uuid) from public, anon, authenticated;
revoke execute on function public.credit_hold(uuid, text[], integer[]) from public, anon, authenticated;
revoke execute on function public.credit_release(uuid, text) from public, anon, authenticated;
revoke execute on function public.credit_release_stale(interval) from public, anon, authenticated;
revoke execute on function public.debit_ai_call() from public, anon, authenticated;
grant execute on function public.credit_gate(uuid) to service_role;
grant execute on function public.credit_hold(uuid, text[], integer[]) to service_role;
grant execute on function public.credit_release(uuid, text) to service_role;
grant execute on function public.credit_release_stale(interval) to service_role;

commit;
