# start_url accepts bare domains

`?start_url=stripe.com` was refused (no scheme) and the visitor landed on /app with no hint why.

- `startUrlOf` (`src/lib/start-url.ts`, shared by client and server) trims the value and prepends
  `https://` when there is no scheme. `host:port` is not mistaken for a scheme. All refusals stay:
  non-web schemes, credentials, internal hosts and IPs, single-label hosts, over 2000 chars.
- `startUrlRefusal` names the reason; `rememberStartUrl` logs it with `console.warn` when the
  parameter is present but refused. Landing is unchanged.
- Discarded: prepending `http://` as a fallback; a scheme-less `localhost` is refused either way.
