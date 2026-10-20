# Static build for the native shells

`npm run build:spa` (`DEPLOY_TARGET=spa`, `PUBLIC_API_BASE=<api host>`) builds the app with
`adapter-static` into `build-spa/` (fallback `index.html`, nothing prerendered). The Tauri shell
(`FEEGA_URL=bundle`) and the mobile app bundle that folder. The static adapter is declared as
supporting `instrumentation.server.ts`: a bundle has no server, so the file is simply unused.

What makes the bundle talk to the API:

- **CORS** (`$lib/server/api-cors.ts`, first handle in `hooks.server.ts`): `tauri://localhost`,
  `http(s)://tauri.localhost`, `capacitor://localhost`, `https://localhost`, plus
  `API_EXTRA_ORIGINS` for a deployment (e.g. a local check), get preflights and
  `access-control-allow-origin` on every route.
- **Bearer on every route**: with no session cookie, `safeGetSession` verifies an
  `Authorization: Bearer` token (`$lib/server/bearer-session.ts`) and `locals.supabase` carries
  it. The cookie routes the canvas still reads (`/session`, chat, …) answer a bundle unchanged.
  CSRF already let bearer requests through.
- **Fetch routing** (`$lib/api/bundle-fetch.ts`, installed in `hooks.client.ts` when
  `PUBLIC_API_BASE` is another host): same-origin calls to anything but the bundle's own files go
  to the API host with the bearer.
- Vercel analytics is not injected in a bundle (its script is not there).

Verified with `npm run smoke:spa <bundle url> <shots dir>` (`scripts/spa/smoke.mjs`, served by
`scripts/spa/serve.mjs`): test account → `/app` dashboard → project → its canvas, every
`/api/v1` call 200, nodes on the canvas.

Known gap: media. `<img>`/`<video>` sources point at `/p/.../assets/<id>`, a cookie-signed
redirect; an element cannot send a bearer, so in the bundle they do not load. They need signed
URLs resolved before render (`asset-urls`) — next step.

Not verified against `feega.app`: production runs `main`, which has none of these endpoints
until a release; the smoke ran against this branch's API on the production database.
