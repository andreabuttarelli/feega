drop policy if exists "feature_flags readable by anon" on public.feature_flags;
create policy "feature_flags readable by anon" on public.feature_flags
  for select to anon using (key = 'social_publishing');
