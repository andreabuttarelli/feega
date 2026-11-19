# Feega Inspect: edit a running app from the editor

New extension in `inspect/`, separate from the canvas extension in `vscode/`. It starts the
app's dev server, shows the page in a webview, and edits the clicked element through the same
code the canvas live edit uses.

Path: `feegaInspect.open` (`inspect/src/host/extension.ts`) → `startDev` (`dev-server.ts`,
`runPlan` from `@feega/dev-run`) → webview `App.svelte` → `pageBridge` (`feega:inspect` to the
`feega-source-map` bridge) → `Properties.svelte` (`NumberField`/`InspectorSection` from
`@feega/properties-panel`, rows in `controls.ts`) → `ToHost.Edit` → `fileEdits`
(`stylePatch` + `tokenOf` from `@feega/live-edit`) → file written → Vite HMR.

Decisions:

- **No change to the user's config.** For Vite, SvelteKit and React Router the extension runs
  a launcher that loads the app's own `vite.config` and puts `feegaSource()` first. Appending
  it after the config's plugins broke SvelteKit: the plugin received compiled JS for `.svelte`
  ids ("Expected token }").
- **Undo is file-level**, kept in the host: restore only if the file still equals what we wrote.
- **127.0.0.1, not localhost.** Chromium resolved `localhost` to `::1` and the iframe loaded
  `chrome-error://`.
- Text edits are refused: they need `write-back` (inlang catalogs), which stays in the app.

Limits: frameworks without Vite need `feega-source-map` in their config; non-Tailwind projects
get the class but no visual change (the landing used for the test is one: the preview shows the
edit inline until reload); the colour control is a native picker, not the app's ColorField
(still coupled to app stores).

## Round 2: user reports

- **Edits reverted after reload / after closing the panel.** The file was written (git showed it),
  but `landing/` has no Tailwind, so `font-bold`, `text-[#0078d4]`, `rounded-[12px]` had no CSS.
  Not a revert: no write on dispose. Now `stylingOf` reads `package.json`: Tailwind → classes as
  before; anything else → real CSS in the element's `style` attribute (`styleAttr`, JSX gets a
  `style={{…}}` object). Inline was chosen over the component `<style>` block: it wins over any
  global rule (`landing.css`) without a specificity fight. Round-trip matrix
  (`inspect/test/matrix.mts`): every control, edit → reload → computed style.
- **Preview lost on hot reload.** Previews are kept in the bridge and re-applied to re-rendered
  elements (`keepPreviews`); after the write `feega:preview:settle` drops the inline style if the
  page alone produces it, or reports it as "no effect on this page".
- **Typography on a section.** Sections come from one table `roles.ts` (role from tag, own text,
  child elements, display).
- Double-click text edits literal text in place (`literalText`); expressions are refused with
  their location. Design/Navigate segmented control (D/N), address bar with history, server dot,
  device sizes (shared with Play: `devices`, `viewport-box` moved to `@feega/properties-panel`),
  collapsible bar, "Saved to file:line".

## Round 3

- **Style block, not inline.** Without Tailwind, Svelte/Vue edits go into the component `<style>`
  as a rule on the element's class (`scoped-rule.ts`); the rule active at the preview width is the
  one edited, because landing's `@media` rules otherwise won. JSX without a stylesheet keeps an
  inline style and the panel says so.
- **Layout.** VS Code's default webview `body` padding made side gutters; reset. The preview has a
  fixed viewport (presets now have heights) and the page scrolls inside it; the mode bar is fixed
  over the preview, draggable to six anchors.
- Breadcrumb + Esc/Enter/Tab selection moves, per-side padding/margin and per-corner radius with a
  hover hint, units (px/rem/em/%/vw/vh/auto), shadow and fill lists (Bits UI popovers), reorder by
  drag in the preview and in the Layers tab (`move-node.ts`: literal siblings only, `{#each}` and
  `.map()` refused), dev server popover (state → actions table), Feega menu with settings.

## Round 4

- **Attach only to our own server.** A Next app on :3000 from another folder got attached. Now a
  running server is attached only when the process listening on the port has its cwd inside the
  workspace's app (`listener.ts`, via `lsof`); otherwise Inspect starts its own on a free port.
- **"This element" on a CSS-module class.** The writer edited `styles.card` itself, so every
  sibling changed. Element scope now adds the element's own module class
  (``className={`${styles.card} ${styles.appSection}`}``) and writes there; reused next time.
  Svelte/Vue scoped rules already did this.
- **Open in editor.** One host path (`open-source.ts`): workspace-relative or absolute file,
  line/col selection, beside the panel when it sits in column one, error toast instead of silence.
  Changes rows get an Open link. Text from data names the definition:
  "This text comes from data: `AGENT_LOGOS` (home.ts:12)." (`data-source.ts`: same-file
  declaration or relative named import).
- **Typography on wrappers.** `h1 > span + span` had no Typography: the role table called any
  element with children a container. Text tags are text by tag now, and an element whose
  descendants are only inline text elements (`inlineText` from the runtime) is text too.
- **Live scrub.** Dragging a number label wrote only on release and the field snapped back.
  `scrub.ts` previews once per animation frame while dragging, writes once on release (one undo
  step), debounces arrow nudges 300 ms, and holds the released value against stale reads for
  1.5 s. Every number row and the shadow fields go through it; the test is parametrised over
  the controls table.
- **Outline follows the element.** `track.js` in the bridge watches the selected and hovered
  sources (MutationObserver, ResizeObserver, scroll/resize/load), coalesces reads per frame and
  re-sends the rect; after HMR the element is found again by source.
- **Show after Hide.** Show wrote the remembered `display` value back. An empty css value now
  means "remove this declaration" in every writer (scoped rule, module rule, inline style); an
  emptied rule, `<style>` block or `style=""` goes too.
- The frame's fixed width tag is gone; only the W × H label while dragging a handle remains.
- **Icons from raw markup.** landing's `a.mac` icon is `{@html APPLE_ICON}`: no source tag, and
  the picker climbed to the link. The bridge now hit-tests down by rect (`deepestAt`, also past
  `pointer-events: none`); an untagged svg is inspected on its own (`inner: 'svg'`, media role)
  and written as `.own :global(svg)` (Svelte) / `:deep(svg)` (Vue) / `.own svg` (modules) on the
  parent's own class. Tailwind refuses it with a reason. Not done: Cmd-click / double-click drill.
- **One colour picker.** Gradient stops and shadow colour used the native input; both open the
  shared ColorPicker with the palette now (`ColourSwatch.svelte`).
- **Device bar.** The native select + bare width box became a segmented of device icons (Full,
  desktop, tablet, phone; keys 1–4), a grouped Bits dropdown with every preset and its W × H, a
  W × H readout (width editable), and rotate for tablets (`rotated` in `sizes.ts`). Handles are
  8×40 pills, col-resize, Shift for 10 px steps (`Snap.Coarse`), double-click back to Full.
  Not done: bottom height handle, phone rotation. One shared input reset (`.field input`) removes
  the nested input border.
- **Design this folder / page with Feega.** Explorer context commands (`commands.ts` enum, titles in
  package.json). The app root is the clicked folder or its nearest package.json inside the
  workspace (`app-root.ts`), so `landing/` inside the repo works; "Open the running app" on a
  workspace without an app at the root offers a quick pick of the apps below it. Switching apps
  asks first. Not done: opening the route that renders a clicked page file.
- **Design this page** opens the route the clicked file renders (`page-route.ts`: SvelteKit
  `+page`, Next `app/…/page` and `pages/`, Nuxt/Astro `pages/`, plain html; route groups
  dropped, dynamic segments fall back to the current route).
- **Edits update in place.** The matrix now checks, per fixture, that a style edit keeps the
  page (a window marker) and its scroll: green on react/vue css+tailwind, tailwind-app, Next and
  landing. If the page reloads anyway, the bridge (`reload-restore.js`) puts the scroll back,
  selection is re-resolved, and the panel shows a short toast; reloads the panel asked for skip it.
- **Page styles.** Clicking the bare page, or Esc from a top-level element, selects the Page
  (`PAGE_SOURCE` in the runtime); its edits write a `body` rule in the global stylesheet
  (`page-rule.ts`, `selectorInBody`), with Tailwind or plain CSS alike. `html` is supported by the
  writer; no UI entry for it yet.
- **More properties.** `CSS_ROWS` in `controls.ts` is one table: each row names the CSS
  property, its control and section; the Tailwind change is an arbitrary property
  (`[grid-template-columns:1fr_2fr]`), plain-CSS projects get the same declaration through the
  existing writers. Line clamp is the exception (`line-clamp-N`, boxed preview). Sections render
  generically and start closed. `×` writes an empty value, which drops the token or declaration.
  The runtime reports, for inherited properties, the topmost ancestor with the same value
  (`inherited`); the row dims and names it. Not done: inherited dimming on the hand-laid
  Typography rows, and telling a default apart from a set value for non-inherited properties.
