set search_path = public, extensions;
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ai_calls_billing_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.billing_scope := case when public.project_is_uncensored(new.project_id) then 'uncensored' else 'standard' end;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.apply_store_event(_event_id text, _org_id uuid, _store text, _environment text, _type text, _product_id text, _payload jsonb, _outcome text, _grant_credits integer, _grant_source text, _grant_expires_at timestamp with time zone, _revoke_credits integer, _plan text, _plan_expires_at timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.store_events (id, org_id, store, environment, type, product_id, outcome, payload)
  values (_event_id, _org_id, _store, _environment, _type, _product_id, _outcome, _payload)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if _grant_credits > 0 then
    insert into public.credit_ledger (org_id, kind, source, amount, store_event_id, expires_at, note)
    values (_org_id, 'grant', _grant_source, _grant_credits, _event_id, _grant_expires_at, _store || ' ' || _product_id);
  end if;

  if _revoke_credits > 0 then
    insert into public.credit_ledger (org_id, kind, source, amount, store_event_id, note)
    values (_org_id, 'debit', 'refund', _revoke_credits, _event_id, _store || ' refund ' || _product_id);
  end if;

  if _plan = 'set' then
    update public.orgs
    set store_plan_product = _product_id, store_plan_store = _store, store_plan_expires_at = _plan_expires_at
    where id = _org_id;
  elsif _plan = 'clear' then
    update public.orgs
    set store_plan_product = null, store_plan_store = null, store_plan_expires_at = null
    where id = _org_id and store_plan_product = _product_id;
  end if;

  return 'applied';
end; $function$;

CREATE OR REPLACE FUNCTION public.assets_uncensored_from_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.uncensored_project := public.project_is_uncensored(new.project_id);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.auth_admin_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select org_id from public.orgs_members where user_id = auth.uid() and role in ('owner', 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.auth_editor_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select org_id from public.orgs_members where user_id = auth.uid() and role in ('owner', 'admin', 'member')
$function$;

CREATE OR REPLACE FUNCTION public.auth_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select org_id from orgs_members where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.billing_grants_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) = 2
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'stripe'
    and (c.relname, t.tgname) in (('checkout_sessions', 'trg_grant_from_checkout'), ('invoices', 'trg_grant_from_invoice'));
$function$;

CREATE OR REPLACE FUNCTION public.canvases_no_share_in_uncensored()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.share_token is not null and public.project_is_uncensored(new.project_id) then
    raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.commit_motion_revision(p_org_id uuid, p_node_id uuid, p_expected integer, p_doc jsonb, p_summary text, p_actor_kind text, p_actor_id uuid, p_agent_key text, p_coalesce_ms integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  head public.motion_revisions%rowtype;
begin
  select * into head
  from public.motion_revisions
  where org_id = p_org_id and node_id = p_node_id
  order by version desc
  limit 1
  for update;

  if coalesce(head.version, 0) <> p_expected then
    return null;
  end if;

  if p_coalesce_ms > 0
    and head.id is not null
    and not head.sealed
    and head.actor_kind = p_actor_kind
    and head.actor_id is not distinct from p_actor_id
    and head.agent_key is not distinct from p_agent_key
    and head.created_at > now() - make_interval(secs => p_coalesce_ms / 1000.0) then
    update public.motion_revisions
    set version = p_expected + 1, doc = p_doc, summary = p_summary, created_at = now()
    where id = head.id;
  else
    insert into public.motion_revisions (org_id, node_id, version, doc, summary, actor_kind, actor_id, agent_key)
    values (p_org_id, p_node_id, p_expected + 1, p_doc, p_summary, p_actor_kind, p_actor_id, p_agent_key);
  end if;

  return p_expected + 1;
exception
  when unique_violation then
    return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.credit_ledger_billing_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.billing_scope := coalesce((select billing_scope from public.ai_calls where id = new.ai_call_id), 'standard');
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.credits_from_price_id(price_id text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.feega_credits(p._raw_data->'metadata'->>'credits')
  from stripe.prices p
  where p.id = price_id
    and p._raw_data->>'currency' = 'eur'
    and p._raw_data->'metadata'->>'app' = 'feega';
$function$;

CREATE OR REPLACE FUNCTION public.delete_account(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_blocked uuid[];
  v_delete uuid[];
  v_kept integer;
begin
  select coalesce(array_agg(m.org_id), '{}') into v_blocked
  from orgs_members m
  where m.user_id = p_user
    and m.role = 'owner'
    and not exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user and o.role = 'owner')
    and exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user);

  if cardinality(v_blocked) > 0 then
    return jsonb_build_object('status', 'transfer_required', 'org_ids', to_jsonb(v_blocked));
  end if;

  select coalesce(array_agg(m.org_id), '{}') into v_delete
  from orgs_members m
  where m.user_id = p_user
    and not exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user);

  select count(*) into v_kept from orgs_members m where m.user_id = p_user and not (m.org_id = any(v_delete));

  delete from orgs where id = any(v_delete);

  delete from chat_threads where created_by = p_user;
  delete from org_uncensored_optins where enabled_by = p_user;
  update org_uncensored_optins set disabled_by = null where disabled_by = p_user;
  update orgs_invites set invited_by = null where invited_by = p_user;
  update nodes set actor_id = null where actor_id = p_user;
  update nodes set lock_actor_id = null where lock_actor_id = p_user;
  update nodes_connections set actor_id = null where actor_id = p_user;
  update node_runs set actor_id = null where actor_id = p_user;
  update posts set actor_id = null where actor_id = p_user;
  update ad_campaigns set actor_id = null where actor_id = p_user;
  update ad_campaigns set approved_by = null where approved_by = p_user;
  update ai_calls set actor_id = null where actor_id = p_user;
  update chat_messages set actor_id = null where actor_id = p_user;
  update canvas_events set actor_id = null where actor_id = p_user;
  update influencers set actor_id = null where actor_id = p_user;
  update moderation_checks set actor_id = null where actor_id = p_user;

  insert into account_deletions (orgs_deleted, orgs_kept) values (cardinality(v_delete), v_kept);

  delete from auth.users where id = p_user;

  return jsonb_build_object('status', 'deleted', 'org_ids', to_jsonb(v_delete));
end;
$function$;

CREATE OR REPLACE FUNCTION public.embed_node_writable(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case
    when object_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$' then exists (
      select 1 from public.nodes n
      where n.id = (split_part(object_name, '.', 1))::uuid
        and n.deleted_at is null
        and n.org_id in (select public.auth_org_ids())
    )
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_free_org_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _joining_is_free boolean;
  _free_count integer;
begin
  select not exists (
    select 1 from public.credit_ledger cl
    where cl.org_id = NEW.org_id
      and cl.source in ('subscription_renewal', 'one_time_purchase')
  ) into _joining_is_free;
  if not _joining_is_free then
    return NEW;
  end if;
  select count(*) into _free_count
  from public.orgs_members m
  where m.user_id = NEW.user_id
    and not exists (
      select 1 from public.credit_ledger cl
      where cl.org_id = m.org_id
        and cl.source in ('subscription_renewal', 'one_time_purchase')
    );
  if _free_count >= 2 then
    raise exception 'free_org_limit_reached' using errcode = 'P0001';
  end if;
  return NEW;
end; $function$;

CREATE OR REPLACE FUNCTION public.feega_credits(_value text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when _value ~ '^[1-9][0-9]{0,8}$' then _value::integer end;
$function$;

CREATE OR REPLACE FUNCTION public.feega_org_from_metadata(_metadata jsonb)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select o.id
  from public.orgs o
  where _metadata->>'app' = 'feega'
    and o.id = case
      when _metadata->>'org_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (_metadata->>'org_id')::uuid
    end;
$function$;

CREATE OR REPLACE FUNCTION public.gallery_count_remix()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.gallery_items set remix_count = remix_count + 1 where id = new.item_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_credits_from_checkout_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _raw jsonb := NEW._raw_data;
  _org_id uuid;
  _credits integer;
begin
  if _raw->>'mode' is distinct from 'payment'
    or _raw->>'status' is distinct from 'complete'
    or _raw->>'payment_status' is distinct from 'paid' then
    return NEW;
  end if;
  _org_id := public.feega_org_from_metadata(_raw->'metadata');
  _credits := public.feega_credits(_raw->'metadata'->>'credits');
  if _org_id is null or _credits is null then
    return NEW;
  end if;
  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_checkout_id, expires_at)
  values (_org_id, 'grant', 'one_time_purchase', _credits, 'checkout:' || NEW.id, NEW.id, null)
  on conflict (stripe_event_id) do nothing;
  return NEW;
end; $function$;

CREATE OR REPLACE FUNCTION public.grant_credits_from_stripe_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _raw jsonb := NEW._raw_data;
  _subscription_metadata jsonb := coalesce(
    _raw->'parent'->'subscription_details'->'metadata',
    _raw->'subscription_details'->'metadata'
  );
  _line jsonb := _raw->'lines'->'data'->0;
  _org_id uuid;
  _credits integer;
  _period_end text;
begin
  if _raw->>'status' is distinct from 'paid' then
    return NEW;
  end if;
  if coalesce(_raw->>'billing_reason', '') not in ('subscription_create', 'subscription_cycle') then
    return NEW;
  end if;
  _org_id := public.feega_org_from_metadata(_subscription_metadata);
  if _org_id is null then
    return NEW;
  end if;
  _credits := coalesce(
    public.credits_from_price_id(coalesce(_line->'pricing'->'price_details'->>'price', _line->'price'->>'id')),
    public.feega_credits(_subscription_metadata->>'credits')
  );
  if _credits is null then
    return NEW;
  end if;
  _period_end := coalesce(_line->'period'->>'end', _raw->>'period_end');
  insert into public.credit_ledger (org_id, kind, source, amount, stripe_event_id, stripe_invoice_id, expires_at)
  values (
    _org_id, 'grant', 'subscription_renewal', _credits, 'invoice:' || NEW.id, NEW.id,
    case when _period_end ~ '^[0-9]+$' then to_timestamp(_period_end::bigint) end
  )
  on conflict (stripe_event_id) do nothing;
  return NEW;
end; $function$;

CREATE OR REPLACE FUNCTION public.guard_brands_zernio_profile_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.zernio_profile_id is distinct from old.zernio_profile_id and auth.role() <> 'service_role' then
    raise exception 'zernio_profile_id is server-managed' using errcode = '42501';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.link_org_to_stripe_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _org_id uuid := public.feega_org_from_metadata(NEW._raw_data->'metadata');
  _status text := NEW._raw_data->>'status';
begin
  if _org_id is null then
    return NEW;
  end if;
  if _status in ('active', 'trialing', 'past_due') then
    update public.orgs set stripe_subscription_id = NEW.id where id = _org_id;
  elsif _status in ('canceled', 'incomplete_expired', 'unpaid') then
    update public.orgs set stripe_subscription_id = null
    where id = _org_id and stripe_subscription_id = NEW.id;
  end if;
  return NEW;
end; $function$;

CREATE OR REPLACE FUNCTION public.motion_revisions_touch_last_edited()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.touch_last_edited(n.canvas_id, n.project_id) from public.nodes n where n.id = new.node_id;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.nodes_no_public_link_in_uncensored()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.public_token_hash is not null and public.project_is_uncensored(new.project_id) then
    raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.nodes_touch_last_edited()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.touch_last_edited(new.canvas_id, new.project_id);
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.org_credit_balance(_org_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(case when kind = 'grant' then amount else -amount end), 0)::integer
  from public.credit_ledger
  where org_id = _org_id
    and (auth.role() = 'service_role' or _org_id in (select auth_org_ids()))
    and (kind = 'debit' or expires_at is null or expires_at > now());
$function$;

CREATE OR REPLACE FUNCTION public.post_sources_no_uncensored()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (
    select 1 from public.nodes n
    where n.id = new.node_id and public.project_is_uncensored(n.project_id)
  ) then
    raise exception 'uncensored_not_publishable' using errcode = 'check_violation';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.project_has_shares(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.canvases where project_id = p_project_id and share_token is not null)
      or exists (select 1 from public.nodes where project_id = p_project_id and public_token_hash is not null)
$function$;

CREATE OR REPLACE FUNCTION public.project_has_uncensored_outputs(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.assets where project_id = p_project_id and uncensored_project)
      or exists (select 1 from public.ai_calls where project_id = p_project_id and billing_scope = 'uncensored')
$function$;

CREATE OR REPLACE FUNCTION public.project_is_uncensored(p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select mode <> 'standard' from public.projects where id = p_project_id), false)
$function$;

CREATE OR REPLACE FUNCTION public.projects_mode_direction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  refusal text;
begin
  if new.mode = old.mode then
    return new;
  end if;
  if new.mode = 'standard' and public.project_has_uncensored_outputs(old.id) then
    raise exception 'uncensored_outputs_present' using errcode = 'check_violation';
  end if;
  if new.mode = 'uncensored' then
    refusal := public.uncensored_switch_refusal(old.org_id, auth.uid());
    if refusal is not null then
      raise exception '%', refusal using errcode = 'check_violation';
    end if;
    if public.project_has_shares(old.id) then
      raise exception 'uncensored_not_shareable' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.projects_mode_is_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.mode is distinct from old.mode then
    raise exception 'project_mode_immutable' using errcode = 'check_violation';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.storage_write_allowed(bucket text, object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  first text := (storage.foldername(object_name))[1];
  second text := (storage.foldername(object_name))[2];
  editor_orgs uuid[] := array(select public.auth_editor_org_ids());
begin
  if bucket = 'canvas-assets' then
    return case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'influencers' then
    return first = 'catalogue' or case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'embeds' then
    if split_part(object_name, '.', 1) !~* uuid_shape then
      return false;
    end if;
    return exists (select 1 from public.nodes n where n.id = split_part(object_name, '.', 1)::uuid and n.org_id = any(editor_orgs));
  end if;

  if bucket = 'media' and first = 'colours' then
    return case when second ~* uuid_shape then second::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'media' and first ~* uuid_shape and first <> auth.uid()::text then
    return not exists (select 1 from public.brands b where b.id = first::uuid)
      or exists (select 1 from public.brands b where b.id = first::uuid and b.org_id = any(editor_orgs));
  end if;

  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.touch_last_edited(p_canvas_id uuid, p_project_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.canvases set last_edited_at = now()
  where id = p_canvas_id and last_edited_at < now() - interval '30 seconds';
  update public.projects set last_edited_at = now()
  where id = p_project_id and last_edited_at < now() - interval '30 seconds';
$function$;

CREATE OR REPLACE FUNCTION public.transfer_org_ownership(p_org uuid, p_to uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from orgs_members where org_id = p_org and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_to = auth.uid() or not exists (select 1 from orgs_members where org_id = p_org and user_id = p_to) then
    raise exception 'not_member' using errcode = 'P0002';
  end if;

  update orgs_members set role = 'admin' where org_id = p_org and user_id = auth.uid();
  update orgs_members set role = 'owner' where org_id = p_org and user_id = p_to;
end $function$;

CREATE OR REPLACE FUNCTION public.uncensored_switch_refusal(p_org_id uuid, p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when not coalesce((select enabled from public.feature_flags where key = 'uncensored_mode'), false) then 'coming_soon'
    when not exists (select 1 from public.orgs where id = p_org_id and stripe_subscription_id is not null) then 'plan_not_entitled'
    when not exists (select 1 from public.org_uncensored_optins where org_id = p_org_id and disabled_at is null) then 'org_not_opted_in'
    when p_user_id is null or not exists (select 1 from public.user_age_verifications where user_id = p_user_id) then 'age_unverified'
  end
$function$;

CREATE OR REPLACE FUNCTION public.voice_owned_elsewhere(p_voice text, p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.custom_voices
    where provider_voice_id = p_voice and org_id <> p_org
  );
$function$;
