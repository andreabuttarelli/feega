# Motion quality v5: real screens, sourced figures, clean cuts

**Why.** The v4 feega trailer and the 2026-10-11 eval showed six defects: app_browse photographed
the onboarding tour and never reached the editor; the agent filmed only the page after login;
kit cards (UiCardGrid, UiToggle) sat beside the recreated FeegaApp; "1 credit = $1" appeared on
screen without being on the site; 8 frame jumps (v3: 4); the eval's app case exported 15 s of
black.

**What.**

- `overlays.ts`: one table of dismiss strategies (Skip, Got it, Not now, Dismiss, Close, Escape).
  `app_browse` and `recreate_ui` (via `vectorCapture`) dismiss blocking dialogs before each
  capture and report `dismissed`. Detection is generic (`dialog[open]`, `role=dialog`,
  `aria-modal`), never feega-specific.
- `app_browse` returns `links` (in-app hrefs, sign-in/out excluded) and photographs the landing
  when given no pages. `PRODUCT_SCREENS_RULE` in the prompt: at least two work screens (editor,
  canvas, export), never only the hub.
- `Quality.KitUi` (blocking): a story film with any recreated UI component (placed or not) gets
  one problem per kit card placed.
- Critic: edge density (moved from the eval to `$lib/motion/emptiness`) on its own sheet frames;
  each empty frame becomes a fix and caps the score below pass.
- `add_shot` refuses figures in text slots not stated on the pages `analyze_site` read or in the
  script quotes (`unsourcedFigures`). Skipped for fictional brands and before a site was read.
- Smoothness root causes in v4: (1) browser export blur samples straddled clip edges, blending
  half of the outgoing shot into the frame after a cut (11.17 s, 18.53 s, entrance flickers);
  `frameTimes` now pulls a sample that crosses a cut back to the frame time. (2) stat-count
  popped 0→1 at 21.53 s; values under 20 steps no longer count.
- Eval: the driver needs two idle polls with the same thread (the brief auto-sends Go after
  8 s; the old driver reloaded over that turn and killed it). A pid lock per port in the OS temp
  dir refuses a second eval on the same port.

**Discarded.**

- Special-casing feega's tour (`data-testid="tour-skip"`): the table covers it by label.
- Blocking titles with spelled numbers ("Ten tools"): too fuzzy; digits only.
- A gate on the 5-frame gap at 11.17 s: the existing empty-frame gate owns gaps.
