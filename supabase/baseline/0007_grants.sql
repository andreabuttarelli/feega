set search_path = public, extensions;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

revoke all on public.account_strikes from anon, authenticated;
revoke all on public.content_reports from anon, authenticated;
revoke all on public.gallery_items from anon, authenticated;
revoke all on public.gallery_remixes from anon, authenticated;
grant select on public.gallery_items to anon;
grant insert, select on public.gallery_items to authenticated;
grant update (assets, description, doc, poster_url, preview_url, published_at, status, tags, title, updated_at) on public.gallery_items to authenticated;
grant insert, select on public.gallery_remixes to authenticated;

revoke execute on function public.apply_store_event(text, uuid, text, text, text, text, jsonb, text, integer, text, timestamp with time zone, integer, text, timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.auth_admin_org_ids() from public, anon;
revoke execute on function public.auth_editor_org_ids() from public, anon;
revoke execute on function public.auth_org_ids() from public, anon;
revoke execute on function public.billing_grants_ready() from public, anon;
revoke execute on function public.commit_motion_revision(uuid, uuid, integer, jsonb, text, text, uuid, text, integer) from public, anon;
revoke execute on function public.credits_from_price_id(text) from public, anon, authenticated;
revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_free_org_limit() from public, anon, authenticated;
revoke execute on function public.feega_org_from_metadata(jsonb) from public, anon, authenticated;
revoke execute on function public.gallery_count_remix() from public, anon, authenticated;
revoke execute on function public.grant_credits_from_checkout_session() from public, anon, authenticated;
revoke execute on function public.grant_credits_from_stripe_invoice() from public, anon, authenticated;
revoke execute on function public.guard_brands_zernio_profile_id() from public, anon, authenticated;
revoke execute on function public.link_org_to_stripe_subscription() from public, anon, authenticated;
revoke execute on function public.org_credit_balance(uuid) from public, anon;
revoke execute on function public.storage_write_allowed(text, text) from public, anon;
revoke execute on function public.touch_last_edited(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.transfer_org_ownership(uuid, uuid) from public, anon;
