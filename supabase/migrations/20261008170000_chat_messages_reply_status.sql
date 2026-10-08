alter table public.chat_messages
  add column if not exists status text not null default 'done'
    check (status in ('streaming', 'done', 'failed')),
  add column if not exists updated_at timestamptz not null default now();
