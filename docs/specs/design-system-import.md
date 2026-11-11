# Import a design system from code

Status: proposed 2026-11-11. Extends [code-import.md](code-import.md) (ADR
[0028](../adr/0028-code-import-runs-the-app-and-reads-fibers.md)).

Code import turns routes into boards. This spec makes it import the **design system** behind
them: tokens as linked variables with modes, the component library as variant sets, a generated
Design system board, and the same branch/PR round trip for tokens that layers already have.

## Today

### Capability table

| Target | Today | Where |
|---|---|---|
| Variables with types | **Yes**: colour, number, string, boolean | `packages/motion-core/src/motion/variables-model.ts` |
| Modes (theme = mode) | **Yes**, per collection; the frame's mode is `collection.active`, and any clip may override it for its subtree (`clip.modes`, stage 2); instances under an override carry `props.modeValues` | same; `resolveVariables` in `src/lib/motion/variables.ts` |
| Aliases (semantic → primitive) | **Yes**: a mode value may be `{ alias: "Collection/var" }`, across collections, resolved with a cycle guard | `variables-model.ts`, `valueOf` in `src/lib/motion/variables.ts` |
| Layer property → variable | **Yes**: `clip.bind[target] = "Collection/var"`; the literal stays in `props`, rewritten on resolve; a bound field refuses a direct patch | `doc.ts` `bind`, `timeline.ts` (`unbind it first`), `bindableTargets` |
| Bindable targets | Colour/number/text/toggle fields, `fill`, `stroke`, `autoLayout.gap`/`crossGap`/`padding` (one value, all sides), `radius` (rect shapes). **Not** font family (`Control.Font`), border width, opacity, effects, text size in px (props are frame-relative) | `src/lib/motion/variables.ts` |
| Project-wide sharing of variables and styles | **Yes**: `project_library` (kind `style`/`variables`), adopted by every frame of the project | `supabase/migrations/20261031100000_project_library.sql`, `src/lib/server/motion/canvas-variables.ts`, `src/lib/motion/project-library-ops.ts` |
| Limits | 8 collections × 64 variables × 8 modes; names `^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$` (no `.` `/`) | `variables-model.ts` |
| Typography tokens | **Partial**: text styles (font, size, weight, tracking, leading, case, colour) hold literals, cannot reference variables; 40 styles max | `styles-model.ts` |
| Shadow tokens | **Partial**: effect styles (literal) | `styles-model.ts` |
| Spacing, radius tokens | **Yes** as number variables bound to gap/padding/radius | `variables.ts` |
| Border, breakpoint, motion tokens | **Missing** as bindable things. Frames have breakpoints (`breakpoints/model.ts`) but not from variables | — |
| Fonts | **Yes**: `@font-face` read in the page, files imported as assets, ≤24 faces per doc | `page-tree.ts` (`readSheet`), `fonts/model.ts`, `fontsFor` |
| Components, variant sets, instances | **Yes**: `comp.component = { name, set, variant, properties, home }`; code import makes one main per observed variant, instances elsewhere, homed on the Components page | `doc.ts` `mainComponentSchema`, `code-sets.ts`, `component-sheet.ts` |
| Components across frames | **Missing**: an instance cannot point at another frame's main; all boards of an import share one frame | `code-import.md` "Several routes" |
| Variant axes from code | **Partial**: only from props *observed* on captured routes (React, Vue). Svelte keeps no props → no variants. Components not rendered on a route are absent | `code-import.md` |
| Storybook | **Partial**: up to 12 stories, rendered args only, no controls matrix | `import-storybook.ts` |
| Icons | **Partial**: drawn as vectors; library components (lucide, Radix) stay plain layers | `component-marks.ts` |
| Token write-back | **Missing**. Layer write-back exists: inline `style`, or Tailwind arbitrary classes (`bg-[#…]`, `dark:` for the dark board) | `write-back.ts` `CLASS_OF`, `classed` |
| Pull / rebase | **Yes** for layers: `rebased` matches by file + original look, code wins on conflict | `repo-sync.ts` |
| Light/dark capture | **Yes**, but as separate boards (render conditions), not as modes of one board | `render-conditions.ts`, `boards.ts` |

### What the importer extracts today

Computed values only. `pageTreeOf` reads `getComputedStyle`; a Tailwind 4 `oklch()` is painted
on a canvas and read back as rgb. Nothing records which custom property produced a value.

Code import does **not** create variables at all: `codePlan` calls `urlPlan` with
`PLAIN_SHAPE` (`tokening: Off`). URL import does (`token-bind.ts` + `page-tokens.ts`): it
clusters sampled values into one `Default`-mode collection named after the site, with invented
role names (`Background`, `Text muted`). No modes, no source names, no aliases.

Each clip with a dev-source location carries `source = { at, tag, cls, cond, was }`
(`page-tree.ts:1022`, `code-look.ts` `CodeSpot`): `cls` is the element's `class` attribute. So
a computed colour **can** be traced to its Tailwind utility (`text-primary`) when the element has a
location, but only Svelte 5 and React ≤18 provide one (React 19 dropped `_debugSource`), and
nothing maps the utility to its token today. Rules written in plain CSS (`article .prose h2 {
color: var(--color-primary) }`) are not traced at all.

## Grounding: traidue.com

Read from `github.com/andreabuttarelli/traidue.com` @ `5eaea2f`. SvelteKit 2, Svelte 5,
Tailwind 4 (`@tailwindcss/vite`), no shadcn, no `tailwind.config`, no Storybook.

**Tokens** — all in `src/app.css`:

- `@theme`: 15 colours (`--color-primary`, `bg`, `text`, `border`, `muted`, `card`, `surface`,
  `muted-text`, `success`, `error`, `info`, `warning`, `brand-blue`, `brand-pink`, `on-brand`)
  and 2 families (`--font-sans`, `--font-heading`, both Inter).
- `.dark { … }`: 12 of the 15 colours overridden (brand colours are mode-independent). The class
  is set by an inline script in `app.html` and by `ThemeToggle.svelte` from `localStorage.theme`.
- `@font-face` × 2: Inter variable 100–900, self-hosted in `static/fonts/`.
- No custom spacing, radius, shadow or breakpoint tokens: those are Tailwind defaults.
- Root font size changes per breakpoint (16 / 18 / 19 px at 0 / 640 / 1024): every `rem` token
  has a different px value per width.
- Typography lives in plain CSS rules (`article .prose h2 { font-size: 1.5rem; font-weight: 600;
  letter-spacing: -0.025em }`), not in tokens.

Usage: `text-primary` 225, `text-muted` 168, `border-border` 70, `bg-primary` 36, `text-text`
35 … across 44 `.svelte` files.

**Components** — 27 files in `src/lib/components/{ui,quiz,wiki,seo,services,procedures}`. Variant
axes declared in `$props()` types: `Badge.variant` (`default|category|tag`), `Callout.type`
(`info|warning|success|error`), `ThemeToggle` (`dropdown|segmented`), `SearchInput` size
(`sm|base`) and look (`default|filled`), booleans on `Logo`, `SEO`, `ServicesMap`,
`Vaginoplasty3D`.

What this repo proves:

1. **Value matching is not enough.** `primary`, `success`, `error`, `info`, `warning` are all
   `#111111` light and `#f0f0f0` dark: no value-based binder can tell them apart. The class
   (`text-primary`) can.
2. **Svelte variants are readable statically** even though the runtime keeps no props: the
   union types are in the source. Today's import shows none.
3. **Declared ≠ used.** `Badge` declares `variant` and renders the same markup for every value;
   a matrix of identical cells must collapse to one.

## Design

### Entity model

```
TokenSet       one per import: source (repo/folder), sha, the files read
Token          sourceName "--color-primary", group, type, values per mode, origin per mode
  value        literal (normalised: hex for colour, px for length) + raw source text
  origin       file:line:col of the declaration, selector / at-rule that scoped it
Mode           Light | Dark | <named theme>; from the selector that declares it
Component      name, file, axes {axis: values[]}, slots/text props, states
Usage          (existing ComponentUse) + per-property token evidence
```

Mapping to feega:

| Source | feega |
|---|---|
| Colour token | colour variable; theme selectors → modes of its collection |
| Semantic token `--color-primary: var(--primary)` | variable whose mode values are `{ alias }` |
| Spacing, radius, size tokens | number variable (px at the base width; rem kept in the origin) |
| Font family token | string variable (listed, not bindable until Q3) |
| Text scale (`--text-sm` + `--text-sm--line-height`), plain-CSS type rules | text style named after the token/selector |
| Shadow token | effect style |
| Breakpoint, duration, easing tokens | number / string variables, listed on the Design system board, not bound |
| Component + axes | variant set (`component.set`), one main per combination |

Collections, within today's limits: `Colors` (theme modes), `Palette` (primitives referenced by
`Colors`, one mode), `Spacing`, `Radius`, `Type`, `Other`. Each collection is prefixed with the
repo name so two imports don't collide (`traidue Colors`). Only tokens **declared in the repo**
or **referenced by a class used on a captured route** are imported — never Tailwind's whole
default palette (242 colours > 64).

Names: the source name minus `--` and its group prefix, `.` → `_` (`--spacing-0.5` →
`0_5`). The exact source name is kept in the token map, never reconstructed from the feega name.

The token map lives in `nodes.data.code.tokens` next to `repo`/`sha`/`routes`:
`{ "traidue Colors/primary": { name: "--color-primary", origins: { Light: "src/app.css:23:2",
Dark: "src/app.css:46:2" }, raw: { Light: "#111111", Dark: "#f0f0f0" } } }`.

### Extraction: static for definitions, runtime for bindings

**Definitions are read statically** from source files, because only the source has names,
per-theme values, aliases and line numbers. Built CSS has lost `@theme` grouping, Sass names
and the config's structure; the CSSOM keeps custom-property text but not files.

| Source | Read with | Notes |
|---|---|---|
| CSS custom properties in `:root`, `.dark`, `[data-theme=x]`, `@media (prefers-color-scheme)` | a CSS tokenizer on the text (no build) | selector → mode; unknown selectors reported |
| Tailwind v4 `@theme` / `@theme inline` | same | `--color-*`, `--spacing*`, `--radius-*`, `--text-*`, `--font-*`, `--shadow-*`, `--breakpoint-*`, `--ease-*`, `--animate-*` |
| shadcn `components.json` | JSON | gives `tailwind.css` path, `cssVariables`, `aliases.ui` (components dir), base colour |
| Tailwind v3 `tailwind.config.{js,ts,cjs,mjs}` | **evaluated inside the sandbox** (`resolveConfig`, JSON out, 1 MB cap) | it is code: never on our server. Folder source (local mode): a child process on the user's machine, same trust as their dev server |
| Component files | TS compiler API (`.tsx`), `svelte/compiler` parse (`.svelte`) | `cva(…, { variants })`, `tv({ variants })`, union-typed props, `$props()` types |

**Bindings are decided per layer at runtime**, in the existing capture, from this evidence in
order:

1. **Utility class** on the element (`cls`, captured for every element, not only located ones)
   → theme key → token: `bg-primary` → `--color-primary`, `p-4` → `--spacing` × 4,
   `rounded-lg` → `--radius-lg`. A static table per Tailwind major, one row per utility family.
2. **Matched rule with `var()`**: in the page, for properties we bind (colour, background,
   border colour, gap, padding, radius), the winning declaration among rules whose text contains
   `var(--` and `el.matches(selector)`; the token is the outermost `var()` name. Specificity is
   computed, ties go to the later rule.
3. **Unique value across every captured mode**: the computed value equals exactly one token's
   value in Light **and** in Dark. Ambiguous (traidue's `primary`/`success`) → literal.
4. Otherwise the literal stays, counted in the report ("312 bound, 41 literal").

A binding is kept only if it is consistent on every captured scheme: a layer bound to
`Colors/primary` must show the token's Dark value on the dark capture, else it is a literal.

### Boards bind instead of copying

With bindings, the dark render is the light board in the Dark mode, not a second capture.
Dark captures are still taken, but only to verify bindings (rule above) and to find layers whose
dark look is not a token (kept as today's separate dark board for those routes).

Stage 2 ships the override (Q1): a Dark capture is kept as its own board, bound like the light one
and set to Dark, so a layer whose dark look is not a token keeps its literal, per layer.

### Design system board

One more board in the import frame (boards share a frame so instances can link), placed before
the routes:

- **Colours**: one swatch per token, a column per mode; swatches are rects bound to the variable,
  so editing a swatch edits the token. Aliases print their target.
- **Type**: one sample line per text style, with its size/leading/weight.
- **Spacing, radius, shadow**: bars, rounded squares and cards bound to the tokens.
- **Other**: families, breakpoints, durations and easings as labelled rows.
- **Components**: the Components page already lays out every variant set (`componentPages`);
  the board links there instead of copying it.

### Components: the whole library, not what a route happens to render

1. **Discover** statically: files under shadcn `aliases.ui` (default `components/ui`), else
   `src/lib/components/**`, `components/**`; exported components; axes from `cva`/`tv`/union
   props; Storybook stories when `.storybook/` exists.
2. **Render a matrix** inside the sandbox: we write a gallery route into the clone (`app/
   __feega/page.tsx`, a Vite entry, or `src/routes/__feega/+page.svelte`) that renders each
   component × each axis value (cartesian, capped at 64 per set, one axis varied at a time
   beyond that), each cell in an error boundary, children = the component name. It is our code
   but runs only in the sandbox, next to the repo's.
3. **Capture** it like a route; `component-marks` names the cells; `code-sets` makes the mains.
   Cells that render identically collapse (traidue `Badge`). Cells that throw are reported.
4. Page usages then link to these mains, so a route is instances of the library.

Icons: an icon import from a known set (`lucide-react`, `@lucide/svelte`, `@tabler/icons-*`,
`@heroicons/*`) becomes a main `Icon/<Name>` on first use; only icons used are imported.

### Pull

Identity of a token is its **source name**, never its feega name or value.

| Upstream | Canvas | Result |
|---|---|---|
| added | — | variable added, unbound |
| value changed | untouched | value updated, bound layers follow |
| value changed | edited, not published | code wins, conflict reported (same rule as layers) |
| removed | bound by layers | variable kept, marked `orphan` in the map, reported; layers keep their look |
| removed | unbound | variable removed |
| renamed (one removed + one added in the same file, same values in every mode) | — | rename: every `bind` key rewritten |
| mode added / removed | — | mode added / removed; a frame whose active mode vanished falls back to the first |

Components follow the existing rebase (`rebased`) plus: a set whose file disappeared keeps its
main, marked orphan; a new axis value adds a main; a removed one turns its instances into
instances of the `Default` combination, reported.

### Write-back

A variable edit is a `SourceEdit` of kind `token`: replace the declaration's value text at
`origins[mode]`, in the same format it was written (hex → hex, `oklch()` → `oklch()`,
`rem` → `rem` using the root size at the captured width). It goes through `CodeSource.publish`
like layer edits: one branch, one PR.

| Canvas change | Written as |
|---|---|
| variable value in a mode | the declaration in that mode's selector |
| variable now aliases another | `var(--other)` |
| alias replaced by a literal | the literal; the PR body says the alias was broken |
| layer rebound to another variable | its utility swapped (`bg-primary` → `bg-surface`) via the existing `classed`; a `var()` rule edit if bound by rule |
| new variable | appended to the block of its mode (`@theme` / `:root` / `.dark`) |
| v3 config value | a string literal in the config object, located with the TS parser; computed values (`colors.blue[500]`) refused, reported |
| variable renamed | refused in v1: renaming a token means editing every usage |

### Unsupported, and why

| Stack | Status | Reason |
|---|---|---|
| Next.js / React + Tailwind (3/4) + shadcn | stage 1–3 | first target |
| SvelteKit + Tailwind | stage 1–3 | same token path; variants from `$props()` types |
| Any framework with plain CSS custom properties (Vue, Nuxt, Astro, CSS Modules, Chakra v3, MUI CSS-vars mode) | tokens: stage 1; components: what runtime import already reads | tokens are framework-independent |
| W3C design-tokens JSON | stage 5 | static JSON, write-back trivial; bindings only through the CSS it generates |
| SCSS / LESS variables | tokens read-only, no bindings | compiled away: the page holds literals, nothing to trace a layer back to |
| JS/TS theme objects (styled-components, Emotion, MUI `createTheme`) | literal object exports only, read-only | values computed at runtime; evaluating them means running app code outside the sandbox's dev server |
| vanilla-extract, Panda, Stitches, UnoCSS | via plain CSS variables if they emit them | the source of truth is generated code |
| Plain-CSS rules with descendant selectors (`article .prose h2 { color: var(--x) }`) | not traced | `el.matches()` on our static selectors is deterministic, but choosing the winning declaration needs the full cascade (specificity, order, `@layer`, `!important`, inline); the consistency check cannot catch a wrong winner when tokens share a value (traidue's `primary`/`success`). CDP `CSS.getMatchedStylesForNode` gives the true cascade but costs a round trip per node (~1 500 per page) inside the capture budget. On traidue those elements are `{@html}` output with no source location anyway |
| Angular, React Native, Flutter | unsupported | no component reading in the page (Angular) / no DOM (RN, Flutter) |

### Security

- Static extraction reads text with bounded parsers: ≤300 files, ≤512 KB each, ≤8 MB in all;
  no `import()`/`require` of repo files on our server, no `eval`.
- Anything that must execute (Tailwind v3 config, the gallery route) runs in the Vercel Sandbox
  that already runs the repo, with no environment of ours; its output is JSON with a size cap and
  is schema-checked before use.
- The capture browser stays the fenced `liveBrowser`.
- **Existing gap to fix before stage 3** (more sandbox-origin fetches): `ownImages`
  (`src/lib/server/code-import/page-images.ts`) fetches sandbox-origin images with plain
  `fetch`, which follows redirects — untrusted code in the sandbox can answer `302` to an
  internal address — and reads the whole body before checking the 15 MB cap. It should go
  through `safeFetchBytes` with the sandbox origin allowed, or `redirect: 'manual'` plus a
  streaming cap.
- Write-back edits only files listed in the token map or `source.at`; paths are relative,
  normalised, and refused if outside the repo.

## Product gaps

Each is a question; the recommendation is the default if nobody answers.

1. **Mode below the frame?** One frame holds every board, and the active mode is per frame, so
   Light and Dark cannot sit side by side. *Recommendation:* `clip.modes?: Record<collection,
   mode>` on any container, inherited by descendants (Figma's model). Needed by stage 2; stage 1
   ships with the frame-level switch.
2. **Limits.** 64 variables per collection and 8 collections fit shadcn (~30 colours) and
   traidue (15), not a full Tailwind theme. *Recommendation:* import only used/declared tokens
   (above); raise to 256 per collection only when a real repo hits it.
3. **Font family as a variable?** `Control.Font` is not bindable. *Recommendation:* make it
   bindable to string variables (font names already are strings); otherwise families are listed
   only.
4. **Text styles referencing variables?** Styles hold literals, so a size token edit does not
   reach a style. *Recommendation:* no for now. Import the type scale as text styles keyed by
   token; a style edit writes back to its tokens. Revisit if styles need modes (responsive type).
5. **Responsive values (rem × breakpoint).** traidue's tokens are 16/18/19 px per width.
   *Recommendation:* store px at the base width and the rem in the map; breakpoint modes are
   rejected — a "Phone" mode would mix with Light/Dark.
6. **Border width, opacity, shadow as variables?** *Recommendation:* shadow stays an effect
   style; border width becomes bindable (one row in `bindableTargets`); opacity waits.
7. **Library across canvases.** Variables are project-wide already; components are per frame.
   *Recommendation:* keep components in the import frame through stage 4; a project component
   library is its own spec (it touches instance resolution everywhere).
8. **Gallery route in the user's repo.** It is written only into the sandbox clone and never
   published. *Recommendation:* yes; refuse when the repo has no recognisable router.
9. **Code wins on conflict** for tokens too? *Recommendation:* yes, as for layers; the report
   lists the canvas value so it can be reapplied.

## Stages

| # | Stage | What the user sees | Size | Depends | Risks |
|---|---|---|---|---|---|
| 1 | **Tokens as linked variables** — static CSS/`@theme`/shadcn extraction; class + `var()` + unique-value binding; Light/Dark modes; token map; Design system board (colours, spacing, radius, type samples); token write-back to `.css` | Import traidue: a `traidue Colors` collection with Light/Dark, every `text-primary` layer bound; flip the mode, the boards go dark; recolour `primary` on the board → a PR that edits `src/app.css` lines 23 and 46 | L | none | class capture on every element grows the page tree; `var()` rule matching cost on 1 500-node pages (cap rules scanned) |
| 2 | **Per-board mode** (Q1) and dark boards as modes; Pull reconciliation for tokens | Light and Dark boards side by side from one set of layers; Pull after a token rename keeps bindings | M | 1 | instance override model must carry the mode |
| 3 | **Component library** — static discovery, axes from `cva`/`tv`/prop types, gallery route in the sandbox, page usages link to library mains; Svelte variants | Components page lists every `components/ui` file with its full variant matrix, including ones no route renders; traidue `Callout` shows 4 types | L | 1; `ownImages` fix | providers/required props break cells (reported, not fatal); sandbox time budget (6 min) |
| 4 | **Tailwind v3 config** evaluated in the sandbox; typography and shadows as styles with write-back; icons as components | shadcn v3 projects import like v4 ones; editing a text style opens a PR on `--text-*` | M | 1 | config evaluation output size; `rem` round trip |
| 5 | **W3C tokens JSON**, read-only SCSS/LESS and theme objects | Those repos get a token list and board, without bindings | S–M | 1 | expectation: tokens without bindings look half-done |

Stage 1 is mergeable alone and already reads as a design system: named tokens, themes as modes,
one board that shows and edits them, and edits that land in the user's CSS.

## Could not determine by reading

- Whether `variables.ts`'s resolve step re-materialises bound values on every frame open or only
  on edit (affects how a Pull's new values reach unopened frames).
- How `liveBrowser` exposes stylesheets of cross-origin CSS in the sandbox (`cssRules` throws on
  cross-origin sheets): Vite and Next dev serve CSS same-origin, but a CDN font or theme sheet
  would be skipped by rule 2.
- Whether Next.js 16 dev serves Tailwind 4 CSS with `@theme` names still present in the CSSOM
  (only matters if rule 2 is asked to read `@theme` at runtime; the design reads it statically).
- Real cost of the gallery route on shadcn-sized libraries (~50 components × axes) inside the
  6-minute sandbox budget — needs a measured run.
- Whether `postcss` is a direct dependency we may import (only transitive today); a small CSS
  tokenizer may be cheaper than adding it.
