# @feega/library

The free "basic" library of sections, app pieces and components. An editor Library panel will drag
these into a project; this package is the content and its format.

## Format

```
tokens.css                 shared --feega-* tokens, light and dark
items/<id>/manifest.json   id, name, description, category, tags, frameworks, dependencies, tier
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

Categories: `section`, `component`, `app`. Tier is always `free` here. Items have no dependencies.

## Theming

Every colour, radius and font comes from `--feega-*` tokens in `tokens.css`. Override them on
`:root` (or any ancestor) to retheme. Dark follows `prefers-color-scheme`; `data-theme="light"` or
`data-theme="dark"` on any element forces a theme for its subtree. The test fails on a colour
literal in any item.

## Preview

```
node packages/library/preview/build.mjs     # writes preview/index.html
node packages/library/preview/shots.mjs <dir>   # screenshots, needs Playwright
```

## Not verified

Vue and Astro files are checked structurally by the test (no compiler is installed in the repo).
