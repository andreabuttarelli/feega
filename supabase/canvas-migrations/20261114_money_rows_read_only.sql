begin;

grant execute on function public.auth_org_ids() to authenticated, service_role;

revoke insert, update, delete, truncate, references, trigger on public.credit_ledger from anon, authenticated;
drop policy if exists org_insert on public.credit_ledger;
drop policy if exists org_update on public.credit_ledger;
drop policy if exists org_delete on public.credit_ledger;
drop policy if exists editors_insert on public.credit_ledger;
drop policy if exists editors_update on public.credit_ledger;
drop policy if exists editors_delete on public.credit_ledger;

revoke insert, update, delete, truncate, references, trigger on public.ai_calls from anon, authenticated;
drop policy if exists org_insert on public.ai_calls;
drop policy if exists org_update on public.ai_calls;
drop policy if exists org_delete on public.ai_calls;
drop policy if exists editors_insert on public.ai_calls;
drop policy if exists editors_update on public.ai_calls;
drop policy if exists editors_delete on public.ai_calls;

commit;
