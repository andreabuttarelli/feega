# MCP OAuth pointed at the wrong origin

`cli/lib/config.ts` `PRODUCTION_URL` was `https://www.feega.app`, which has no
OAuth metadata (404), so `mcp.feega.app/.well-known/oauth-protected-resource`
advertised an authorization server clients could not discover and dynamic
client registration failed ("Impossibile registrarsi con il servizio di
accesso"). The app and its `/oauth/*` live on `https://oh.feega.app`
(registration verified: 201). The CLI also embedded the old dazero Supabase
project URL and publishable key; now the live project `klnswzhhgrqvbfjzioul`.
