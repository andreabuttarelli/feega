set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.assets add column if not exists proxy_url text;
