insert into public.feature_flags (key, enabled) values ('social_publishing', false)
  on conflict (key) do nothing;

drop policy if exists "feature_flags readable by anon" on public.feature_flags;
create policy "feature_flags readable by anon" on public.feature_flags
  for select to anon using (true);
