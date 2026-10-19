# Canvas media load in the native bundle

A media element cannot send a bearer, and the bundle has no session cookie for the API host, so
`<img>`/`<video>` pointing at `/p/.../assets/<id>` loaded nothing in the bundle.

Now, in the bundle only:

- `GET /api/v1/me/asset-grant` (bearer) answers an **asset grant**: the caller's own access token
  sealed with AES-256-GCM under a key derived from `APP_SECRET`
  (`$lib/server/canvas/asset-grant.ts`), plus when it expires (the token's own `exp`).
- `asset-url.ts` builds canvas file URLs on the API host with `grant=<grant>` (`useAssetGrant`).
  `canvasAssetUrl`, `sized` and every inline builder that fed an element (`+page.svelte`,
  `GpuFlow`, `media-uploader`, the editor's asset hrefs) go through it. Paths the server sends in
  JSON are rewritten on the way in (`grantedAssetPaths`, in the bundle fetch).
- `hooks.server.ts` opens a grant only on a `GET` of a canvas asset path and uses the token inside
  as the request's bearer: the asset route runs unchanged, with the user's RLS.
- The root layout fetches the grant before the first render and refreshes it 5 minutes before the
  token expires (`$lib/api/asset-grant.ts`).

Discarded: a service-role grant (HMAC of user + org) — the asset route signs only with a
user-scoped client as proof of membership (`signAssetPaths`), and that rule stays. Discarded too:
the plain token in the URL — it would sit in history and logs readable.

Cost: asset URLs change when the token refreshes (about hourly), so elements refetch once then.
Also fixed: the bundle fetch buffers request bodies instead of streaming them, which Chrome
refuses over HTTP/1.1 (`card-previews` uploads failed with `ERR_ALPN_NEGOTIATION_FAILED`).
