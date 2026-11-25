begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_org_idx on public.push_subscriptions (org_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own_read on public.push_subscriptions for select
  using (user_id = auth.uid());
create policy push_subscriptions_own_insert on public.push_subscriptions for insert
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));
create policy push_subscriptions_own_update on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete
  using (user_id = auth.uid());

commit;
