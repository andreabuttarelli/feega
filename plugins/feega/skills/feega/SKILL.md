---
name: feega
description: Set up a web project for Feega visual editing, start the editor, and write markup Feega can edit back into source. Use when the user mentions Feega, `npx feega`, feega-source-map, or wants to design or tweak a running app's UI visually.
---

# Feega

Feega edits a running web app visually: click an element, change it, and the edit is written to the source as a Tailwind class or a CSS rule. It has no AI of its own; you and the user share the same files and every edit is a diff.

Supported: React (Vite), Next.js, Vue (Vite), SvelteKit, Nuxt 4, React Router 7 (framework mode), Astro 5, plain Vite (edits land in `index.html`). Not supported: Angular, static HTML without Vite, Create React App. Styling: Tailwind, CSS modules, scoped `<style>`, plain CSS. Needs Node 20+.

## 1. Set up the project

Done when the dev page carries the Feega source map and picking an element works.

Vite, SvelteKit and React Router get the source map automatically: skip to step 2. Next.js needs `feega-source-map`. Nuxt and Astro need it too, in their Vite config, with the Vite recipe.

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

- Browser, any editor: run `npx feega` in the app folder. Feega finds the app, starts its dev server and opens the editor. Options: `npx feega [dir] [--url <address>] [--port N] [--no-open]`. `--no-open` prints the editor URL. `--url` attaches to a dev server that already runs; never use it on Astro or Nuxt, which map elements to source only when Feega starts the server.
- VS Code, Cursor, Windsurf, VSCodium: install the extension `andreabuttarelli.feega`, then run the command palette entry "Feega: Open from current workspace". Or right-click a folder in the Explorer: "Design this folder with Feega". Or a `.svelte`, `.vue`, `.tsx`, `.jsx`, `.astro` or `.html` file: "Design this page with Feega". "Feega: Open from URL…" attaches to a running app (same Astro/Nuxt limit).

`npx feega` runs until Ctrl+C and stops the dev server it started. Run it in the background, or hand the user the command; do not block on it.

Settings (VS Code, `feegaInspect.*`): `styling` (`auto`, `tailwind`, `css`), `devCommand` (empty: read from `package.json`), `defaultSize` (`full`, `desktop`, `tablet`, `phone`), `keepServerAlive` (minutes), `telemetry`, `plugins.dev` (plugin folders). In `npx feega`, the same live in `.feega/settings.json`. Suggest `.feega/` in `.gitignore`: it holds editor layout and edit history.

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

## 4. Library and plugins

Library: in the editor, select an element, **+ Add** then **Library**, **Insert** (or drag onto the preview). It writes a component for the project's framework into `feega/` under the component folder (`src/lib/components/feega/` SvelteKit, `src/components/feega/` React, Vue, Astro, `components/feega/` Nuxt), plus `tokens.css` and the fonts it uses, and the import. One insert is one undo.

Plugins add controls to the editor. Built in: Mesh gradient and 3D object (`3d` adds `three` to `package.json`; offer the install). Third-party plugins are not reviewed by Feega and run sandboxed, limited to the permissions in their `feega-plugin.json`.

- `npx feega plugin add <github:owner/repo[@tag] | npm-name[@version]>`: shows the permissions and asks the user first. Never approve for them.
- `npx feega plugin list`, `npx feega plugin remove <id>`.
- `npx feega plugin dev <folder> [dir]`: opens the editor with a plugin folder you are building, reloaded on change. In VS Code: `feegaInspect.plugins.dev`.
- To write one, follow https://docs.feega.app/integrations/write-a-plugin/: a folder with `feega-plugin.json` and a bundled script (no imports), using the plugin SDK.

## 5. Editor behavior to expect

- Multi-select: Shift+click or Cmd/Ctrl+click in Layers or the preview. Delete, duplicate, wrap and unwrap apply to all as one undo; styles are edited one element at a time.
- Size has min and max width and height.
- A font that is not installed or loaded shows a notice offering to load it from Google Fonts or replace it.
- The preview reloads itself after the dev server restarts, for example after a dependency install.

## 6. Read the user's selection over MCP

When the user says "this element", "the card I picked" or "what I just changed", ask Feega instead of guessing. Add the server once: `claude mcp add feega -- npx -y feega mcp` (Cursor: `.cursor/mcp.json`; Codex: `~/.codex/config.toml`; see docs.feega.app, "Connect your agent via MCP").

Local tools, no sign-in, need Feega open in the project (`npx feega` or the VS Code panel):
- `feega_selection`: the selected element's file, line, selector and view, the same text as "Copy for agent". Edit that location.
- `feega_changes`: the visual edits made this session, with the files each touched.
- `feega_editors`: the editors running on this machine. Pass `project` (a folder) to `feega_selection` or `feega_changes` to ask another one.

If a tool answers that no editor is running, tell the user to open Feega in the project first; do not start one for them. The Cloud tools (`feega_share`, `feega_snapshot`, `feega_comments`, `feega_resolve`, `feega_stop`) need `npx feega` sign-in or `FEEGA_API_KEY`, and a Feega Cloud plan.

After editing, tell the user what changed and that Feega shows the same edits under Changes, where each is undoable.
