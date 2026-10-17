# The native app is one Tauri 2 shell that loads the hosted app, over a PWA baseline

Context: feega must be installable on macOS, Windows, iOS and Android. The app is SvelteKit with
server routes (form actions, `/api/v1`, `/auth/callback`, SSR pages) deployed on Vercel: there is
no static build to bundle, and none is planned. Whatever the shell, it shows `oh.feega.app` in a
system WebView.

Options weighed:

| | (a) Tauri 2 everywhere | (b) Capacitor mobile + Tauri/Electron desktop | (c) PWA only |
|---|---|---|---|
| Codebases | one Rust crate, one config | two shells, two plugin ecosystems | none |
| Remote URL | `WebviewUrl::External` | `server.url` (documented as dev-only, works in prod) | native |
| Deep link `feega://` | `tauri-plugin-deep-link`, desktop + mobile | Capacitor App plugin + a desktop one | no custom scheme |
| Share sheet, camera roll, files | plugins (dialog, fs, share via community) or Swift/Kotlin plugin | richest plugin catalogue | Web Share, `<input type=file capture>` |
| Push | community plugin or own Swift/Kotlin plugin | `@capacitor/push-notifications` | Web Push (iOS 16.4+, installed only) |
| Size | ~10 MB desktop, system WebView | Electron ~150 MB | 0 |
| Store review 4.2 | needs native features | same | not in store |

Decision: **(a) Tauri 2 for all four platforms, PWA as the baseline.** Default confirmed. The
shell loads the hosted app today and is built to load a static bundle later (option (d) below):
the start URL is configuration, not code.

- One shell. Capacitor's real edge is its mobile plugin catalogue; the features we need first
  (deep link, external browser, dialog, notifications) exist as official Tauri 2 plugins, and the
  rest is a small Swift/Kotlin plugin Tauri 2 supports natively. Two shells would double signing,
  CI and updates for no feature we need today.
- Electron is out: it ships Chromium (+150 MB) to show a site, and gives nothing over WKWebView on
  macOS that matters to us except Chromium parity.
- The PWA is not an alternative but the floor: same manifest, icons and safe areas serve the
  shell, and users who never install a binary still get an installable app.

Auth. Google refuses OAuth in an embedded WebView (`disallowed_useragent`), and Apple prefers the
system browser. Flow:

1. The shell sets a user agent containing `FeegaNative`.
2. The login action sees it and asks Supabase for `redirectTo = feega://auth/callback?...`
   instead of `https://<host>/auth/callback`. The PKCE verifier cookie is set in the WebView.
3. The shell opens every navigation off the app host in the system browser.
4. Supabase redirects the browser to `feega://auth/callback?code=…`; the OS hands it to the shell
   (`tauri-plugin-deep-link`), which navigates the WebView to `https://<host>/auth/callback?code=…`.
5. The existing callback exchanges the code with the verifier the WebView already holds.

No new endpoint, no token passes through the URL beyond the one-time code. `feega://auth/callback`
must be on Supabase's redirect allow-list. Later, iOS/Android should move to universal/app links
(`https://oh.feega.app/auth/callback` verified), which cannot be hijacked by another app
registering `feega://`; PKCE already makes a stolen code useless without the verifier.

WebView limits:

- WKWebView is Safari: the canvas pan/zoom fix in #553 applies as is; anything that is slow in
  Safari is slow in the macOS and iOS shells. WebView2 (Windows) and Android WebView are Chromium.
- Autoplay: muted inline video plays; sound needs a gesture. Same rule as Safari today.
- Video export through WebCodecs: WKWebView follows Safari's support; no regression versus web.
- Service worker: not available in WKWebView for non-bound domains on iOS; the shell must not
  depend on it. It caches only the static shell anyway.

App Store guideline 4.2 (minimum functionality): a WebView over a website is rejected. Before
submitting iOS we add what the browser cannot do: share-sheet export of a rendered video to
Photos, camera-roll picker into the asset library, push notifications for finished renders, and
`feega://` / universal links. Mac App Store is optional: notarised direct download needs no review.

Updates: the UI is the hosted app, so a deploy updates every shell. Only the shell binary needs
`tauri-plugin-updater` (desktop, signed update feed) or store releases (mobile), rarely.

Accounts and signing the user provides: Apple Developer Program (99 USD/yr; Developer ID cert for
macOS notarisation, distribution cert + provisioning for iOS), Google Play Console (25 USD once,
upload key), Windows code-signing cert (OV/EV or Azure Trusted Signing), a Tauri updater key pair,
and the bundle id `app.feega.desktop` reserved in both stores.

## Desktop performance decides the desktop shell

Tauri on macOS is WKWebView (Safari's engine); on Windows it is WebView2 (Chromium). Electron ships
Chromium everywhere. The canvas has WebKit-only workarounds (#495 player transform, #553 pan/zoom
lag), so on macOS the question is whether WKWebView holds the canvas budget of #553: >=55 fps
average, >=45 fps p5.

Measured 2026-10-14, M-series Mac, the #553 harness (23 motion tiles, synthetic posters) driven by
`apps/native/bench/bench.js`: 6 s of wheel pan, 6 s of ctrl-wheel zoom, rAF gaps recorded in page.

| Shell | pan avg / p5 fps | zoom avg / p5 fps | frames >33 ms | size | memory |
|---|---|---|---|---|---|
| Chromium 153 (Playwright, headed) | 60 / 56 | 60 / 56 | 0 / 0 | — | 167 MB JS heap |
| WebKit 26.6 (Playwright, headed) | 58 / 53 | 60 / 56 | 2 / 0 | — | — |
| Electron 44 (Chromium 152) | 60 / 55 | 59 / 55 | 0 / 2 | 288 MB runtime | 868 MB RSS, all processes |
| Tauri 2, system WKWebView | **not measured** | **not measured** | — | 10.4 MB `.app` | — |

The Tauri row is empty because the Mac's screen was locked during the run: WKWebView reported
`visibilityState: hidden` and delivered 0 animation frames, so nothing could be timed. The other
rows ran with background throttling disabled and no visible compositor, so they show the main
thread keeps up, not what a GPU-composited window on a 120 Hz display does. All three measured
engines pass the budget.

Decision for desktop: **provisional**. Tauri stays the default because the measured WebKit engine
passes, and the cost gap is large (10 MB vs ~290 MB, ~3x memory). The shell is a thin layer (start
URL, deep link, external navigation in `routing.rs`): swapping desktop to Electron is about a day.
Gate: run `apps/native/bench` on an unlocked Mac, Tauri vs Electron. If Tauri's WKWebView misses
55/45 on either sweep, or shows WebKit-only visual defects the Chromium build does not, desktop
moves to Electron and mobile stays Tauri (Capacitor adds nothing Tauri lacks for a remote-URL
shell). Windows is Chromium (WebView2) under Tauri either way.

## (d) A static, frontend-only build talking to the API

The alternative to loading the site: ship a SvelteKit build with `adapter-static` and an SPA
fallback inside the shell, calling the hosted API with a bearer token.

Inventory on `dev` (2026-10-14):

| What the UI relies on | Count | Lines |
|---|---|---|
| `+page.server.ts` (load and/or actions) | 52 | 5,353 |
| `+layout.server.ts` | 5 | 258 |
| files with form actions | 35 | ~160 actions |
| non-API `+server.ts` (callbacks, embeds, renders) | 39 | — |
| `/api/v1` endpoints (CLI/MCP, bearer auth) | 82 | — |
| `hooks.server.ts` (host redirect, CSRF, cookie Supabase client, org/landing cookies) | 1 | 266 |

The heavy part is concentrated: the canvas page (`p/[projectId]/c/[canvasId]`, 1,582 lines, ~20
actions: `write`, `batchWrite`, `template`, `create`, `move`, `resize`, `connect`, `run`, …) and the
motion editor (341 lines, 21 actions). Already covered by bearer-auth equivalents:

- canvas: `POST /api/v1/org/canvas` with `CANVAS_OPS` (40 ops: create/update/move/resize/connect/
  delete/run/duplicate/share/templates/uploads) — most canvas actions map 1:1;
- motion: `/api/v1/motion/[nodeId]` (+ revisions, render, frames, templates, agent);
- brand settings, products, api-keys, billing checkout/portal, gallery, media, attachments sign.

Not covered: login (10 actions; becomes client-side Supabase), project/team/profile/danger
settings, studio, compose, upscale, assets, influencers, calendar, ads, and every page `load`
(the SPA needs a read endpoint per page, or `/org/query`/`/org/rows` extended).

What must stay server-side whatever the client: Realtime authorisation (client subscribes with
the user JWT, RLS decides — already the case), storage signing (`attachments/sign`,
`signKnowledgePaths`), paid actions behind `gateAiAction`/`gateOrgAiAction`, Stripe, provider keys,
Server-Timing.

Auth in (d): the Supabase client lives in the bundle with PKCE (verifier in app storage), the
system browser does OAuth, `feega://auth/callback?code=` returns to the shell, the client exchanges
the code itself, and every API call carries `Authorization: Bearer <jwt>` — which `resolveOrgCaller`
already accepts. No cookies, no CSRF.

Migration path, route by route, never big-bang:

1. For each page, move `load` and actions into `/api/v1` endpoints (or `CANVAS_OPS`-style op
   tables), with the page's server file calling the same function. Web keeps working; CLI and MCP
   gain the operation for free. Canvas first (largest, mostly done), then motion, settings, the rest.
2. Client-side data layer: pages read through a `fetch`-based client instead of `PageData`.
3. When no route the native app opens has a `+page.server.ts`, add a second build target
   (`adapter-static`, `fallback: 'index.html'`, `ssr = false`) for `apps/native`, and point the
   shell's start URL at the bundle.

Effort: ~6–8 engineer-weeks (canvas 1–2, motion 1, settings/brand/billing 1–2, the other ten
pages 2, auth + static target + shell 1), plus a test per moved endpoint. What it buys:

- one API for app, CLI and MCP — the rule "app → CLI → MCP" becomes structural, not discipline;
- a bundled UI that starts offline and paints without a network round-trip;
- a stronger 4.2 case (an app, not a website), though Apple still judges features, not bundling;
- cost: the UI no longer updates with a deploy — store review for every UI release on iOS unless
  the bundle is fetched remotely, which returns to (a). Server and bundle versions must be
  compatible across releases.

Recommendation: do (a) now; pursue step 1 for its own sake (it is the API the CLI and MCP need
anyway) and decide step 3 when the canvas and motion pages have no server file left.

Consequences:

- `apps/native/` holds the shell, outside the npm workspace and outside CI until it ships.
- The server knows one thing about the shell: the `FeegaNative` user-agent mark, read in one module.
- The shell never exposes Tauri IPC to the remote origin (no `remote` capability) until a native
  feature needs it; then only that command, only for the app host.

## Settings on the API, and what stays server-only (2026-10-15)

Settings sections `project`, `brand`, `video`, `profile`, `content`, `team`, `api-keys`, `danger`
render on the client (`ssr = false`) from `/api/v1/me/projects/<id>/settings` (the settings shell)
and `/settings/<section>` (`GET` load, `POST ?action=`). The endpoint runs the same functions the
pages ran (`$lib/server/settings/`), with the project shell from `p/[projectId]/+layout.server.ts`
as parent. `src/routes/api/v1/me/projects/[projectId]/settings/server.test.ts` holds parity: every
load and every action answers and writes the same as calling the function directly.

The `/p/[projectId]` layout itself (project shell, canvases) still loads on the server: it belongs
to the canvas move.

Inventory of the remaining server-only routes:

| Route | Recommendation | Why |
|---|---|---|
| `/app/studio`, `/app/studio/[batchId]` (`/p/…/studio` redirects there) | Migrate | Signed-in dashboard surface; plain loads and actions (upload, quote, generate, run, approve…), same pattern as `/me/pages`. |
| `/app/upscale` | Migrate | One load, one action; cheapest of the lot. |
| `/app/compose` | Migrate | List + create; dashboard surface. |
| `/app/compose/[nodeId]` | Migrate with the editor | An editor surface (layout, gallery publish); belongs to the editor's API move. |
| `/p/…/assets` | Migrate | Project library; signed URLs are made server-side and travel fine as data. |
| `/p/…/influencers` | Migrate | Loads + generate/upload/template actions; no cookie-only dependency. |
| `/p/…/brands`, `/brands/new`, `/brands/[slug]` | Migrate | Brand kit; the wizard's analyze/sync are server calls the API can run. |
| `/p/…/settings/products` | Migrate | Brand kit, read-only list; next to `brand`. |
| `/p/…/settings/billing` | Keep | A redirect to `/app/credits`, already client-rendered. |
| `/p/…/promote`, `/p/…/calendar`, `/p/…/ads`, `/settings/connected-accounts` | Keep web-only, then remove | Social publishing (Zernio, Meta ads) is behind the off `social_publishing` flag and is being removed (focus on motion); moving it would build an API for code on its way out. |
| `/p/…/settings/facebook`, `/linkedin`, `/connect/[platform]` | Keep web-only | Provider OAuth returns to the hosted origin with cookies; same fate as social publishing. |
| `/s/[token]` (share) | Keep web-only | Public, no session; server-rendered for link previews. |
| `/render/[token]` | Keep web-only | Token page the render farm loads headless; not a user surface. |
| `/oauth/authorize`, `/register`, `/token` | Keep web-only | OAuth authorization server for MCP clients: browser redirects and the cookie session are the protocol. |
| `/admin/reports` | Keep web-only | Internal moderation, no native use. |
| `/report`, `/report/counter` | Keep web-only | Public abuse form, no account. |
| `/gallery`, `/gallery/[id]` | Keep web-only | Public and indexed; in-app reads already use `/api/v1/gallery`. |
| `/a/[id]`, `/d/[token]`, `/e/[id]` | Keep web-only | Public embeds and downloads. |
