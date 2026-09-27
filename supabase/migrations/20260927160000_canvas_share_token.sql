alter table public.canvases
  add column if not exists share_token text unique,
  add column if not exists shared_at timestamptz;
