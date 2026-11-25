# Desktop v2

The desktop app starts a project without a terminal and carries the editor's features.

## Welcome screen

Signed-out users see the sign-in screen first, as before. After sign-in the Node check runs, then the welcome screen: **New project**, **Open folder**, **Recent projects** (existing store).

## Node check

At app open the main process reads the login-shell `PATH` once (`$SHELL -ilc 'echo $PATH'`, macOS and Linux) and merges it into `process.env`, so children (agents, npm, dev servers) find the user's tools.

Then `node -v` and `npm -v` run with that PATH. Node missing, npm missing or Node below `MIN_NODE_MAJOR` (from `npx/src/node-version.ts`) shows one screen: reason, **Install Node.js** (nodejs.org), **Check again**.

## New project

Inputs: framework, template, folder, name, optional "Describe it".

| Framework | Scaffold | Feega plugin |
|---|---|---|
| React (Vite) | bundled files | `feega init` plan |
| Next.js | bundled files | `feega init` plan |
| SvelteKit | bundled files | `feega init` plan |
| Vue (Vite) | bundled files | `feega init` plan |
| Astro | bundled files | none (started by Feega) |
| Nuxt | bundled files | none (started by Feega) |

Bundled files, not `create-*` tools: deterministic, no interactive prompts, only `npm install` needs the network.

Templates: Blank, Landing, Portfolio, Dashboard. Each is a list of free library sections inserted with the editor's library insert. No Pro items.

Flow: write files, apply init plan, `npm install` with progress, open as a tab, start the dev server. "Describe it" is sent to the AI chat after open if an agent is connected.

## New page

A "+" next to the route field in the editor. Asks a route name and a template (blank or a library section), writes the file at the framework's route path, navigates there. It lands in Changes with undo. Works in the extension too.

| Framework | File |
|---|---|
| Next | `app/<route>/page.tsx` |
| SvelteKit | `src/routes/<route>/+page.svelte` |
| Astro | `src/pages/<route>.astro` |
| Nuxt | `pages/<route>.vue` |
| React Router, Vite SPA, Vue SPA | refused: a router config must change |

## Cloud

Desktop sets `FEEGA_CLOUD=1` for the editor only when "Feega Cloud (beta)" is on in settings. Default off until the relay is live.

## Storage

Desktop sets `XDG_CACHE_HOME` to a folder under its user data, so AI adapters auto-install into a writable path.

## Out of scope

New component, extract to component: next PR.
