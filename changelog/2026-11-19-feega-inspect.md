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
