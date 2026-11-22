---
name: feega
description: Set up a web project for Feega visual editing, start the editor, and write markup Feega can edit back into source. Use when the user mentions Feega, `npx feega`, feega-source-map, or wants to design or tweak a running app's UI visually.
---

# Feega

Feega edits a running web app visually: click an element, change it, and the edit is written to the source as a Tailwind class or a CSS rule. It has no AI of its own; you and the user share the same files and every edit is a diff.

Supported: SvelteKit, Vite (React, Vue, Svelte), React Router, Next.js, Nuxt, Astro. Styling: Tailwind, CSS modules, scoped `<style>`, plain CSS. Needs Node 20+.

## 1. Set up the project

Done when the dev page carries the Feega source map and picking an element works.

Vite, SvelteKit and React Router get the source map automatically: skip to step 2. Next.js needs `feega-source-map`; other frameworks (Nuxt, Astro) need it too, in their Vite config, with the Vite recipe.

1. Add the dev dependency: `feega-source-map` at `^0.1.0` in `devDependencies`, then install.
2. Edit the config, once. If it already mentions `feega-source-map`, change nothing.

Next.js (`next.config.ts`, `.mjs` or `.js`): import and wrap the default export.

```ts
import { withFeegaSource } from 'feega-source-map/next';

export default withFeegaSource(nextConfig);
```

CommonJS configs: `const { withFeegaSource } = require('feega-source-map/next');` and `module.exports = withFeegaSource(nextConfig);`.

Vite (`vite.config.ts`, `.mts`, `.js` or `.mjs`): add the plugin first in `plugins`.

```ts
import { feegaSource } from 'feega-source-map/vite';

export default defineConfig({ plugins: [feegaSource(), /* existing plugins */] });
```

The VS Code extension does the same edit from its "Add the Feega plugin" link in the panel; offer it when the user already has the extension.

## 2. Start visual editing

Pick by what the user has open:

- Browser, any editor: run `npx feega` in the app folder. Feega finds the app, starts its dev server and opens the editor. Options: `npx feega [dir] [--url <address>] [--port N] [--no-open]`. `--url` attaches to a dev server that already runs; `--no-open` prints the editor URL.
- VS Code, Cursor, Windsurf, VSCodium: install the extension `andreabuttarelli.feega`, then run the command palette entry "Feega: Open from current workspace". Or right-click a folder in the Explorer: "Design this folder with Feega". Or a page file (`.svelte`, `.vue`, `.tsx`, `.jsx`, `.astro`, `.html`): "Design this page with Feega".

`npx feega` runs until Ctrl+C and stops the dev server it started. Run it in the background, or hand the user the command; do not block on it.

Settings (VS Code, `feegaInspect.*`): `styling` (`auto`, `tailwind`, `css`), `devCommand` (empty: read from `package.json`), `defaultSize` (`full`, `desktop`, `tablet`, `phone`), `keepServerAlive` (minutes), `telemetry`. In `npx feega`, the same live in `.feega/settings.json`. Suggest `.feega/` in `.gitignore`: it holds editor layout and edit history.

## 3. Write code Feega can edit

Feega writes at the element's source line. Markup it can trace to one literal place stays editable; anything computed is refused with a message pointing at the line.

Class names:
- Write literal `class` / `className` strings. Tailwind utilities, not `cn()`, `clsx()` or template-string expressions, on the elements a person will tweak.
- Put variants in the literal. Element states (`hover:`, `active:`, `focus:`…), responsive breakpoints (`md:` or `@media`) and themes (`dark:` or theme selectors) are written to the matching variant or rule, per the state, preview width or theme chosen in the editor.
- Without Tailwind, give each component its own stylesheet (CSS module or scoped `<style>`) so edits land in that component's rule.

Text:
- Put visible words in the markup. Text from props, constants or data is refused; keep copy that designers change next to its element.

Lists:
- Elements from `{#each}`, `v-for` or `.map` share one source line and cannot be moved one by one. Render a loop over an array literal in the same file so order is editable at the data; keep one-off items outside the loop.

Icons:
- Import icons from `lucide-react`, `lucide-vue-next`, `lucide-svelte`, `@lucide/svelte`, `@heroicons/react`, `@tabler/icons-react`, `@phosphor-icons/react` or `@iconify/react`. Feega swaps icons only for these; other icon sources stay manual.

Structure:
- Duplicate, wrap, unwrap, delete, reorder and add (Text, Heading, Button, Link, Image, Container) are source edits; plain JSX/template elements give the cleanest ones.

Selecting in the editor selects the same element in the code editor, and the reverse. "Copy for agent" copies the selected element with its source location, for you to read and edit.

After editing, tell the user what changed and that Feega shows the same edits under Changes, where each is undoable.
