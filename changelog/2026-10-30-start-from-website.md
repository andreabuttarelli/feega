# Start from your website

The marketing site will send visitors to `https://oh.feega.app/?start_url=<url>`. Before, the
app had no way to receive a site: the visitor signed up and landed on an empty Untitled canvas.

- `start_url` is validated syntactically in `$lib/start-url` (http(s), ≤2000, no internal hosts)
  and again at import time by `assertPublicUrl` (DNS → private address).
- It survives auth twice: in the redirect (`/login?start_url=`, OAuth `redirectTo`, reset-email
  `next`) and in a 30-minute httpOnly Lax cookie set by the hook on entry paths. The hook also
  remembers it on `/auth/callback`, so `landingPath` only reads the cookie — one place, no new
  parameter threaded through every caller.
- `landingPath` → `startPathFor`: profile, org (same bootstrap as `enterApp`), then a project
  named after the host. No extra Untitled project for a new user.
- The canvas reads `start_url`, strips it from the address, and opens `UrlImportDialog` in
  auto-run mode. `extent: 'top'` caps the page tree at 1800 px (`PAGE_EXTENT_HEIGHT`).
- No model call: `PLAIN_PLANNER`; Browserless time is metered as before.

Discarded: running the import server-side before the redirect (30 s+ blank wait, no progress).

Not verified: the native shell's `feega://` OAuth return (the parameter is added, its handler untested).
