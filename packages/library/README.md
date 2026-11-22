# @feega/library

The free "basic" library of sections, app pieces and components. An editor Library panel will drag
these into a project; this package is the content and its format.

## Format

```
tokens.css                 shared --feega-* tokens, light and dark
items/<id>/manifest.json   id, name, description, category, tags, frameworks, dependencies, tier, preview?
items/<id>/svelte/<Name>.svelte      Svelte 5 runes
items/<id>/react/<Name>.tsx + .css   React
items/<id>/vue/<Name>.vue            Vue 3, <script setup lang="ts">
items/<id>/astro/<Name>.astro        Astro
items/<id>/html/index.html + style.css   plain fallback, copy and paste
src/index.ts               typed loader: loadItems, parseManifest, itemFiles
preview/                   static page with every item in light and dark
```

`<Name>` is the id in PascalCase (`hero-split` is `HeroSplit`). Required frameworks: svelte, react,
vue, astro. `html` is a fallback only. No Angular.

Categories: `section`, `component`, `app`. Tier is `free` or `pro`; every item here is `free`.
Optional `preview` is a URL to a preview image. Items have no dependencies.

`fonts` lists the Google Fonts families an item needs, with weights, so the editor can add the
font loading on insert. Only Inter Tight and Fragment Mono are used (`GOOGLE_FONTS` in
`src/index.ts`); every font token falls back to a system stack.

## Source of truth

Items are generated. Edit `tools/*.mjs`, then run `node packages/library/tools/gen.mjs`: it writes
every framework file and manifest from one markup and one CSS list per item. Never edit
`items/` by hand.

## Theming

Every colour, radius and font comes from `--feega-*` tokens in `tokens.css`. Override them on
`:root` (or any ancestor) to retheme. Dark follows `prefers-color-scheme`; `data-theme="light"` or
`data-theme="dark"` on any element forces a theme for its subtree. The test fails on a colour
literal in any item, and on text/fill token pairs under WCAG AA (4.5:1) in either theme.

## Preview

```
node packages/library/preview/build.mjs     # writes preview/index.html
node packages/library/preview/shots.mjs <dir> [ids]   # light and dark at 1280 and 375
node packages/library/preview/overflow.mjs  # horizontal overflow at 360, 375, 768, 1024, 1280
```

## Tests

```
cd packages/library && npx vitest run --config vitest.config.ts
```

Needs `.svelte-kit/` (run `npx svelte-kit sync` once at the repo root) and the Playwright
Chromium for the overflow check.

## Not verified

Vue and Astro files are checked structurally by the test (no compiler is installed in the repo).
