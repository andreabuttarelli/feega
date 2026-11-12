# Import from code

Status: accepted 2026-10-29. ADR: [0028](../adr/0028-code-import-runs-the-app-and-reads-fibers.md).

Paste a GitHub repository URL and a route, get an editable frame where every component of the
codebase keeps its identity: `<Button variant="outline">` is an instance of the main component
`Button`, variant `variant=outline`. Exported back to React, the frame uses the same names and
props.

## Flow

UI "From code…" / `POST /api/v1/projects/:id/code-import` / op `import_code` (MCP `edit`, CLI
`feega canvas import-code`) → `importCodeInto` (`src/lib/server/code-import/canvas-import.ts`)
→ `RepoRunner.start` (Vercel Sandbox: shallow clone, install, dev server on an exposed port)
→ repo component names (`namesIn`, read from the clone) → `importBoards`: each route captured
on the sandbox URL with the names (`pageTreeAt`) → in the page, `componentMarksOf` stamps the root element of each
component usage and returns its name and props → `pageTreeOf` carries the stamp on the node →
`boardsOf` lays the routes side by side → `withComponents` turns usages into variant sets → Figma importer: first render of each variant
is the main, every other render an instance → frame doc → `nodes` + `motion_revisions` →
sandbox stopped.

## What is a component

Read in the page from what each framework's dev build attaches to DOM elements: no plugin, no
change to the repo's build.

| Framework | Read from | Component of the codebase | Props |
|---|---|---|---|
| React (client) | `__reactFiber$…`, composite fibers between a host element and the host above | name declared in a `.tsx`/`.jsx`/`.js` of the repo, or annotated by react-docgen (`__docgenInfo`), or whose `displayName` ends in such a name (`HeroUI.Button` → `Button`) | `memoizedProps` |
| React server components | `_debugInfo` on the fibers a server component produced (React 19 dev) | name declared in the repo | `props` of the debug entry |
| Vue 3 | `__vueParentComponent`, the instances whose `subTree.el` is the element | `__file` outside `node_modules`, or a known name, or docgen | `props` |
| Svelte 5 | `__svelte_meta`, the `component` entries of the dev stack | definition file and tag site outside `node_modules` / `.svelte-kit` | none: Svelte keeps none, so no variants |

Host fibers are `HostComponent`, `HostHoistable` and `HostSingleton` (React 19 `body`/`html`).
Library components (Radix `Slot`, router `Link`, `bits-ui`) stay plain layers.

A name declared in the repo but also imported from a package anywhere in it (`Users` page and
`Users` icon from `lucide-react`) is ambiguous and skipped.

A usage is the component's first host element. A component whose render has more than one root
element (a fragment) is skipped. When components share a root element (`Tooltip` rendering
`Button`) every one is recorded, outermost first, the inner ones with `shares` = the use they sit
in; `withComponents` wraps the element in a frame for the outer component, so the outer main holds
an instance of the inner. A chain keeps its outermost and innermost only: each wrapper is one more
level of nested comps, and the instance diff grows exponentially with that depth (a 6-deep
provider chain: 72 s for a 300-node page, 0.2 s capped). A use on a leaf (an `<svg>` icon component) is wrapped in a frame too:
the Figma importer reads components on containers only.

## Props → variants and texts

Per component, over all its usages on the route:

| Prop | Becomes |
|---|---|
| boolean, or string matching `^[a-z][\w-]{0,23}$` with at most 8 distinct values | variant axis; an absent prop is the value `Default` |
| any other string, and `children` always | text property of the main, overridden per instance |
| functions, objects, numbers, `className`, `style`, `id`, `key`, `ref`, `href`, `src`, `alt`, `on*`, `aria-*`, `data-*`, `asChild` | ignored |
| any prop the source declares as a union, enum or `cva`/`tv` variant (`component-discovery.ts`), when every observed value is declared | variant axis, even `type`, `name`, `value` or a number |

The first render of each variant combination is its main; mains of one component share the set
(`component.set` = component name) and declare a text property per text prop found in their
layers (`properties.children`). Another usage of the same combination builds its own layers and is
diffed against the main (`instance-diff.ts`, shared with URL import's repeated blocks): top-level
differences become overrides (geometry too, for a text or the auto layout container: layout
reflows them); text (and text box) differences inside nested comps become nested
overrides (`overrides` of the inner Precomp, `nestedOverrides`). Any other difference leaves the
usage plain layers, reported; its own nested components still link. A usage whose subtree holds a
component variant not yet seen as a main stays plain layers too (`linkable`), so that variant gets
its main instead of being linked to an older one. At most 64 variants per set.

## Several routes

`routes` (up to 20, default `/`): one sandbox, one tab, the routes captured in turn, then one
frame. Each route is a board named after its path (`boardsOf`: shelf rows under the 16 384 px
side, 160 px gaps, ids prefixed, use indices shifted), and one code-sets pass covers every use,
so a component rendered on two routes has one main and the Components panel lists it once. As
for URL import, every variant set is also laid out on the project's Components page
(`componentPages`) and the page's mains are homed there. A
route that does not open is skipped and reported; the import fails only if none opens. A frame per
route was discarded: an instance cannot point at another frame's main.

Code import skips URL import's `repeatedOf`: identity comes from the code, not from look-alikes.

## Route discovery

`routes-discover.ts` is pure: file list + framework + app folder (from `runPlan`, not re-detected) → routes. `ROUTERS` has one row per file router: frameworks, when it applies, how a file becomes path segments, which files hold param values.

| Router | Framework | Pages | Dropped |
|---|---|---|---|
| Next app | Next | `app/**/page.*`, `src/app/**` | `(group)`, `@slot`; `_private` and `(.)` intercepting segments leave the page out |
| Next pages | Next | `pages/**`, `src/pages/**` | `_app`, `_document`, any `_x`, `api/` |
| SvelteKit | SvelteKit | `src/routes/**/+page(@x).svelte` | `(group)`; `[x=matcher]` → `[x]` |
| Nuxt | Nuxt | `app/pages/**/*.vue`, `pages/**` | `(group)`, `index` |
| Vue pages | Vite with `.vue` in `src/pages` | `.vue`, `.md` minus README | `index` |
| Astro | Astro | `src/pages/**` `.astro .md .mdx .html` | `_x`, endpoints (`.ts`/`.js`) |
| Remix flat | React Router without `routes.ts`, or `flatRoutes()` | `app/routes/*.tsx`, `app/routes/x/route.tsx` | `_index`, `_pathless`, `x_`, resource routes (`.ts`) |
| React Router config | `app/routes.ts` | only `index("f")` and `route("literal", "f")` | `layout(`, `prefix(`, children, computed paths → `routes_in_code` |
| TanStack Router | Vite/generic with `__root.*` | `src/routes/**`, `app/routes/**`, dots as `/` | `index`, `route`, `(group)`, `_pathless`, `-ignored`, `.lazy` |

Paths are written `[x]`, `[...x]`, `[[x]]`, `[[...x]]` for every router (TanStack `$x` → `[x]`, `$` → `[...splat]`; Remix `($x)` → `[[x]]`; React Router `:x?` → `[[x]]`). Order: `/`, static, then dynamic, shallow before deep. Static routes are selected. Same path from two files: the first file wins.

Values for params: a literal `generateStaticParams`/`entries` array of objects with string values naming exactly the route's params; else, for `/<seg>/[slug]`, the md/mdx files directly in exactly one of `src/content/<seg>/`, `content/<seg>/` (a nested folder is ambiguous: none). After capture, same-origin `<a href>` paths in each page's fold (`tab.ui()`, 160 elements per page) that match a pattern; at most 8 values per route. No crawl of its own.

Without booting: GitHub `git/trees/<ref>?recursive=1` (connected account, else public) plus raw reads of the manifests and of the files holding values; a folder walk (local mode); an upload's tar listing. `GET …/code-import/routes`, op `discover_routes`, CLI `--routes discover`. `routes: "all"` imports the selected routes; every import reports in `routes.leftOut` the discovered routes it did not bring: `not_selected`, `needs_value` (with link values), `not_opened`.

Cap 20: the capture budget is 150 s and a page costs about 7 s (16 Storybook stories in ~110 s), so 150 / 7 ≈ 21 pages; 20 leaves room. Conditions multiply pages; past the budget pages are left out and reported, as before.

## Private repositories

The user connects GitHub through Composio (Platform, managed auth): `POST …/github/connect` opens a
Composio session for the owner `<orgId>:<userId>` and answers its Connect Link, with a callback
carrying a sealed state (`APP_SECRET`, 15 min). `GET /api/v1/github/callback` checks the signed-in
user against the state and the `connected_account_id` against the pending row, asks Composio the
account status, reads `/user` for the login and marks the row active. Only the connected account
id is stored (`user_connected_accounts`, per org and user, RLS own rows); tokens stay at Composio.

At import, with an active account: `GET /repos/:owner/:repo` through Composio's proxy; a private
repo's tarball (`/tarball/:ref`) is downloaded on our server from the proxy's binary link (or
GitHub's redirect) and written into the sandbox with `writeFiles`, then unpacked. The sandbox
never sees a token or a signed URL. Public repos keep the shallow clone, connected or not. Up to
200 MB. Repo and branch pickers use the same proxy (`/user/repos`, `/repos/:o/:r/branches`).

The port is `AccountLinks` (`src/lib/server/connections`): link, status, call, forget; the
Composio adapter is REST v3.1 over `fetch`, no SDK (the SDK pulls `openai`, `pusher-js` and a
second `@types/json-schema` that breaks the `ai` package's types). Without `COMPOSIO_API_KEY` it
is `null` and the UI says GitHub is not set up. Drive and Dropbox can move behind the same port.

## Routes behind a login

After each capture the tab's final URL is compared with the route asked (`lockedOut`,
`code-import/sign-in.ts`). A different path that is the account's login path, a sign-in path
(`/login`, `/sign-in`, `/signup`), or a page with a password field means the route is locked: it is
not imported, it is returned in `locked` (`{ label, reason, detail? }`) and listed in `skipped`. All
routes locked: `sign_in_needed`, 422.

With a test account on the project (`app_accounts`, set in settings, chat, API `PUT`, CLI, MCP), the
import signs in once before capturing: the login PATH of `login_url` on the sandbox origin, through
`appBrowse` with an in-memory store (one login routine; the sandbox session never overwrites the
saved one). Each capture tab restores that session. A failed sign-in is reported on each locked
route; public routes import. Folder imports do not sign in.

## Storybook

`storybook` instead of `repo`: `index.json` (Storybook 7+) or `stories.json` (6), stories only
(no docs), interleaved across titles (one story per component, then the second…), at most 12, or
the ids in `stories`. Each `iframe.html?id=<id>&viewMode=story` is captured like a route and
cropped to what it draws (24 px margin); names are the last segment of every title. No sandbox,
no install: the cost is one Browserless session.

## The sandbox

Clone (or the archive of a private repo, unpacked with `tar --strip-components=1`), install, `dev`
on port 4174, then `origin-proxy.ts` on the exposed 4173: it rewrites `Host`, `Origin` and
`Referer` to `localhost:4174` for HTTP and websocket upgrades. Next.js 16 refuses `/_next/*`
from any origin not localhost or in `allowedDevOrigins`; without the HMR socket the client never
hydrates and there are no fibers to read. Vite's allowed hosts are satisfied the same way. The proxy is public, so it answers only the import that started it: a random key per run, sent by
the capture browser as the host-scoped cookie `feega_import_key` (it rides on websocket upgrades
too); without it, 403. The cookie is stripped before the dev server.

## Round trip

Codegen exports a variant set as one component named after the set, with a variant prop per
axis, dispatching to one implementation per variant (`Button` → `ButtonOutline`, …). Instances
export as `<Button variant="outline" children="Cancel" />`; `Default` values are omitted. React
and Svelte; HTML inlines components as before. A comp that is not a main and has no props (a group
made for layout) is inlined as markup, not exported as `Group1…N`.

## Fixes this needed elsewhere

- `pageTreeOf` read only `rgb()`; Tailwind 4 computes `oklch()`, so every fill and text of a
  Tailwind 4 page vanished. Non-rgb colours are painted on a 1×1 canvas and read back.
- `MAX_COMP_DEPTH` 8 → 24: an app page nests components deeper than 8.
- `compBounds` measured a comp whose top clip is another instance as the whole frame; it now
  asks the nested instance's content, so an instance of a wrapper component lays out in auto
  layout like what it shows.

## Measured (2026-10-30)

Captured from the sandbox with a local Chromium, scored by `code-fidelity.browser.test.ts` (SSIM of
the 1280×800 fold; Storybook stories cropped to what they draw). "Plain" is the same page through
URL import without components: equal on every page, identity costs no fidelity. Below 0.95 the
gap is the shared capture/mapping/renderer, not code import.

| App | Pages | Components / variants / instances | SSIM per page (code = plain) |
|---|---|---|---|
| shadcn-admin (Vite, React) | `/` `/tasks` `/users` `/settings` | 84 / 112 / 177 | 0.967 · 0.932 · 0.966 · 0.971 |
| next-app-router-playground (Next 16, RSC) | `/` `/layouts` `/context` | 16 / 25 / 54 | 0.988 · 0.995 · 0.989 |
| svgl (SvelteKit, Svelte 5) | `/` `/extensions` | 31 / 31 / 59 | 0.626 · 0.946 |
| vitesse (Vue 3) | `/` `/about` | 7 / 7 / 1 | 0.992 · 0.997 |
| HeroUI Storybook | 16 stories | 15 / 23 / 15 | 0.85–1.0, median 0.995 |

Sandbox up and capture: 44–67 s per app (4 routes ~67 s); Storybook 16 stories ~110 s. Planning
4 shadcn-admin routes in one frame: 10.7 s (1 400 uses).

## Sync with the source

Each clip drawn from a repo element carries `source = { at: "file:line:col", was }`: the location from the framework's dev metadata (Svelte 5 `__svelte_meta.loc`, React ≤18 `_debugSource`) and the look the import drew, taken after the whole plan (`baselined`). `LOOK` (`src/lib/canvas/code-look.ts`) is the one table of what syncs — text, colour, fill, font size, gap, padding, direction — with read, write and CSS per row.

- **Changes**: a clip whose look differs from `was` is an edit at `at`. Style → inline `style`; text → the literal in the element, else the inlang catalogue entry (`m.key()` in the element, else a unique value). Everything else is reported.
- **Publish** goes through the `CodeSource` port: GitHub = new `feega/<frame>-<time>` branch from the imported sha, one contents PUT per file, PR to the default branch (a branch equal to the default is refused); folder = write files, plus a commit on a `feega/…` branch via a temporary index when it is a git repo, then `was` is rebased onto what was written.
- **Pull** re-imports at the new head into a scratch frame and `rebased` carries local edits to the element with the same file and original look (else same location). Same property changed on both sides: the code wins, reported as a conflict. The merged doc becomes a revision of the original node.
- `nodes.data.code = { kind: github|folder, repo, branch, sha, routes }`; folder head = hash of file sizes and mtimes.
- Folder sources exist in local mode only: the dev server is the user's own, on a loopback port, read by the local Chromium allowed only that origin.

## Rules

- `https://github.com/<owner>/<repo>`, `ref` optional (branch, tag, sha); up to 20 routes, more refused with the count.
- The repo's code never runs on our servers: clone, install and dev server run in a Vercel
  Sandbox, outside our network, with no environment variables of ours. The browser that reads
  the page is the hosted one (`liveBrowser`), fenced like URL import.
- Caps: sandbox 6 min wall clock, 4 vCPU; install 4 min; dev server ready in 90 s; repo files
  scanned for names 4 000; then the URL import caps (1 500 nodes, 3 840 px, 60 images).
- How the repo boots is one pure plan, `runPlan` (`run-plan.ts`), shared by the sandbox and the
  local folder: from the plan-relevant file list (manifests, lockfiles, configs, version files)
  and the `package.json` texts it decides the app folder, the install folder, install and dev
  argv, port/host flags, environment, Node line, or a typed refusal (`no_package`, `no_script`,
  `choose_app` with the apps). Tables: `FRAMEWORKS` (one row per framework: detection, script
  preference, flags, default port) and `MANAGERS` (lockfiles, binary, install args, Node pin).
  Package manager from `packageManager` (pinned through `npx -y <pm>@<version>`; corepack is not
  used because Node 25+ no longer ships it), else the lockfile. Node: `.nvmrc`/`.node-version`/
  `engines.node` mapped to the sandbox images `node:22`, `universal` (Node 24), `node:26`; the
  sandbox boots on `universal` to read the files and reboots once on another image when the plan
  asks for it. The dev server is probed on our port, then the framework's default.
- Monorepo: an app is a non-root package with a framework and a script; the workspace root runs
  only when it holds no app. `tree/<ref>/<path>` is split against the repo's branch list
  (`located`), so a branch with `/` works; the path, or `app`, picks the nearest package.
- Cost: one sandbox (~$0.01–0.03 per import at Vercel Sandbox CPU pricing) + one Browserless
  session. No model call, so not `gateAiAction`; 2 imports per user per 10 minutes.

## Not yet

- Svelte props (Svelte 5 keeps none in the browser): Svelte components have no variants.
- Storybook controls: only the args each story renders with.
- Components not rendered on any imported route or story; environment variables the app needs (an
  app whose auth needs a database or secrets cannot sign in in the sandbox).
