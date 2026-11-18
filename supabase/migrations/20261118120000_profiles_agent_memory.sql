set lock_timeout = '3s';
alter table public.profiles add column if not exists agent_memory text, add column if not exists agent_memory_updated_at timestamptz;
