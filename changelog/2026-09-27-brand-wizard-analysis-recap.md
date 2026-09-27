# Brand wizard: real loading steps, a readable recap, and a scroll fix

## Loading state

The "website" step used to just say "Reading…" on the submit button while `?/analyze` ran.
`runBrandAnalysis` (`src/lib/server/brand-analysis.ts`) actually goes through a fixed sequence —
fetch homepage, parse metadata/logo/colours, follow internal links, detect products, extract
social handles, draft a target audience — so the loading UI now names those phases instead of
staying silent.

`src/lib/brand-wizard-analysis-steps.ts` is a pure module (`ANALYSIS_STEPS`,
`analysisStepIndexAt`) cycling one step every `ANALYSIS_STEP_INTERVAL_MS` (2.5s), looping. No
server progress event is wired into the client today (`onProgress` in `runBrandAnalysis` is
server-side only, not streamed), so this is a truthful-but-timed loop, not the request's actual
phase — the labels are real, the timing is a guess. A thin indeterminate progress bar and
`prefers-reduced-motion` guards (same pattern as `CanvasEntryShimmer`) round it out.

## Recap step redesign

The "analysis" step showed name/description inside `<input>` fields even before any edit — now
name is a heading, description a paragraph, with an explicit "Edit" button per field that swaps
it for an input (blur swaps back). `draft.name`/`draft.shortDescription` and the hidden inputs on
the create form are untouched — only the display changed.

## Images grid (scope added mid-task)

`runBrandAnalysis` already collects up to N image URLs from every page it visits
(`harvestPageImages`, already filtering icons/sprites/tracking pixels/logos and deduping) into
`profile.images` — the cap just went from 20 to `MAX_SITE_IMAGES = 60`. `WizardAnalysis` now
carries `images: string[]` through `analyzeWizardSite` → the `?/analyze` action result →
`draft.images`, shown as a grid in the recap. Backward compatible: an old cached action result
without `images` just renders an empty grid. Display-only — not re-hosted into storage, same as
`logoUrl` today; re-hosting is a separate, untested change this task didn't ask for.

## Scroll and layout bugs (found mid-task, fixed separately)

Every wizard step's `<section class="panel">` collided with a global, unscoped `.panel { overflow:
hidden }` in `src/app.css` (a dashboard-tile style, meant for a different part of the app —
Svelte's scoped styles don't stop an outer global rule from matching the same class). With 14+
products the panel silently clipped instead of scrolling; `Continue` and everything past product
~9 was unreachable. Renamed the wizard's class to `.wizard-panel`.

Same bug, second instance: every `<label class="field">` collided with `app.css`'s dashboard
`.field { padding: 18px 22px; border-bottom: ...; display: flex; align-items: center; }`,
overriding the wizard's own `flex-direction: column` layout and pushing borders/padding onto
every input and textarea. Renamed to `.wizard-field`. Both renames are local to this file — no
other page used these two class names for the wizard's own scoped styles.

## Colour swatches on the Target step

The Target step's "Colours" list (parsed from the `## Colours` markdown section, same as the
overview's live preview) showed bare hex text. Each colour now gets a square swatch — the same
detection the doc node already uses (`tokenizeChips`/`HEX_COLOUR` in
`src/lib/canvas/brand-content-chips.ts`, replacing this file's own looser line parser) — clicking
the swatch opens the browser's native colour picker bound to the same value; the hex text stays
editable alongside it. The chip/swatch CSS (`.chip`, `.chip-swatch`, `.chip-platform`) that
`renderBrandContentHtml` relies on was duplicated as a `:global(...)` block inside
`brands/[slug]/+page.svelte`; moved (move-only) into `doc-prose.css` under `.doc-prose .chip*` so
every consumer of that renderer — the brand page and the wizard's own overview preview — shares
one definition instead of each carrying its own copy.
