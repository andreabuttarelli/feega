# PWA baseline

First step of ADR 0009 (native shell over the hosted app): the web app is installable on its own.

- `static/site.webmanifest`: `id`, `scope`, maskable icon (`icon-maskable-512.png`, the 512 icon
  at 80% on its own background), colours from the dark `--grey-0` token instead of `#111111`. A
  test reads `src/app.css` so the two cannot drift.
- `src/app.html`: theme colour per scheme, iOS standalone metas. Status bar style `default`, not
  `black-translucent`: translucent would put content under the notch on every full-height layout
  (`100vh` in `.app`), and none of them pad for `safe-area-inset-top` yet.
- `src/app.css`: side safe-area insets in standalone only (landscape notch). Bottom was already
  handled by `--mobile-bar-clearance`.
- `src/service-worker.ts` gains a fetch handler. Policy in `src/lib/pwa/shell-cache.ts`: only
  same-origin GETs of `build` assets and a few icons/fonts, cache-first. `/api/`, `/auth/`,
  `/oauth/`, pages and any other origin (Supabase) pass through untouched. No precache of `build`:
  the app has hundreds of chunks and installing them all would cost every visitor the whole app.
  The cache is keyed on the release version and dropped on activate.

Discarded: offline page fallback (pages are per-user SSR; an offline shell needs the static build
discussed in the ADR).
