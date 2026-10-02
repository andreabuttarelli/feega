insert into storage.buckets (id, name, public) values ('quarantine', 'quarantine', false)
  on conflict (id) do nothing;
