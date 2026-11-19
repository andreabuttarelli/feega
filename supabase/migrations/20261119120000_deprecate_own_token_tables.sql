comment on table public.user_figma_tokens is
  'DEPRECATED 2026-11-19: Figma connects through Composio, no code reads or writes personal tokens. Use user_connected_accounts.';

comment on table public.user_cloud_tokens is
  'DEPRECATED 2026-11-19: Google Drive and Dropbox connect through Composio, no code reads or writes OAuth tokens. Use user_connected_accounts.';
