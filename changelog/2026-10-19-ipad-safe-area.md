# Safe-area insets on tablet and desktop layouts

The page uses `viewport-fit=cover`, but only the phone top bar applied
`env(safe-area-inset-*)`. On iPad (native shell, PWA) the canvas header with Share
and chat toggle sat under the status bar.

- `src/lib/styles/safe-area.css`: `--safe-*` tokens and `.safe-shell`, padding on all
  four insets. `data-safe="sides"` keeps only left/right for the phone shell, whose bars
  and sheets pad top/bottom themselves.
- Applied to the project shell (canvas, editor, pages) and `AppShell` (dashboard).
- Removed the `display-mode: standalone` body padding: it doubled with the shell.
- Test: `safe-area.test.ts` overrides `--safe-*` in Chromium and checks computed padding.

Not changed: the iOS shell user agent is fixed to iPhone (`apps/native/src-tauri/src/lib.rs`).
Picking it per idiom needs a UIKit call; app code only reads the `FeegaNative/` mark and a
mobile regex that matches iPad either way.

The WebKit-only `first_child_getter` error on `/app` in dev was a stale Vite deps cache
(two Svelte runtime instances), not app code: see LESSONS.md.
