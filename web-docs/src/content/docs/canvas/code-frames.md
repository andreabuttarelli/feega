---
title: Code frames
description: Write React or Svelte on the canvas and see it run live.
sidebar:
  order: 12
---

A code frame runs real component code on the canvas: a landing page, a pricing table, a whole small site with several pages. Add one with **Code frame** from the add bar (under *More nodes*); it starts as a React counter. The tabs on top switch between **URL**, **HTML**, **React** and **Svelte** (switching framework replaces the code with a starter, after asking).

- **Files.** A frame holds several files. The entry is `App.tsx` for React and `App.svelte` for Svelte; it must `export default` the component. Add a file with **+** (for example `pages/Pricing.tsx`) and import it with a relative path (`./pages/Pricing`). `.tsx`, `.ts`, `.jsx`, `.js`, `.svelte` and `.css` files are supported.
- **npm packages.** Bare imports load from [esm.sh](https://esm.sh): `framer-motion`, `lucide-react`, `react-router-dom`, `gsap` and most packages work without setup. React is 19.1, Svelte is 5.38.
- **Tailwind.** Tailwind classes work out of the box.
- **Live.** The frame recompiles half a second after you stop typing. Compile errors and runtime errors show in a red panel inside the frame; the canvas is never affected.
- **Pages.** Use `MemoryRouter` from `react-router-dom` in React. `HashRouter` and `BrowserRouter` need a real page address, which a frame does not have. In Svelte, links like `<a href="#/pricing">` with a `hashchange` listener work.
- **Animations.** Entrance and scroll animations run inside the frame, which scrolls on its own: `framer-motion` (`whileInView`), GSAP `ScrollTrigger`, Svelte transitions and `IntersectionObserver`.
- **Size.** The page is laid out at the frame's width: resize the frame to see the narrow layout.
- **Fonts.** Fonts uploaded to the organization are already declared inside the frame: `font-family: "Family"` uses them. See [Uploaded fonts](/canvas/fonts/).
- **Safety.** The code runs in a sandboxed iframe with no access to your session or the app.

## Several pages side by side

**Open page in new frame** on a code frame asks for a route (`/pricing`) and opens a **view** next to it: a frame that shows the same site at that route. The code lives once, in the source frame; editing it re-renders every view. Links clicked inside a view stay in that view. Each view shows its route at the top, and you can change it there. If the source frame is deleted, its views say so instead of showing a blank page.

In React, start the router at the view's route: `<MemoryRouter initialEntries={[feega.route]}>`. In Svelte, read `location.hash` (a view opens at `#/pricing`).

## Variables

Copy, colours and settings that someone may want to change without touching code are **variables**, declared where they are used:

```tsx
<h1>{feega.var('heroTitle', { type: 'text', default: 'Build faster', label: 'Hero title' })}</h1>
<section style={{ gap: feega.var('gap', { type: 'range', min: 0, max: 64, step: 4, default: 24, label: 'Gap' }) }} />
<a style={{ background: feega.color('accent', '#ff5100') }}>Start</a>
```

| Type | Right bar control | Metadata |
|---|---|---|
| `text` | single-line field | |
| `longtext` | multi-line field | |
| `color` | colour picker + hex | hex only (`#ff5100`) |
| `range` | slider | `min`, `max`, `step` |
| `number` | number field | `min`, `max`, `step` |
| `boolean` | checkbox | |
| `select` | dropdown | `options: [...]` |
| `image` | URL + preview | http(s) URL |
| `font` | text field | font family |

Shorthands work when no metadata is needed: `feega.text(name, default)`, `feega.color(name, default)`, and one per type. Values are stored on the frame, separate from the code, and reach the page without recompiling. Select the frame (or one of its views) to edit them in **Properties**; double-click a text bound to a variable to edit it in place. Views share the values of their source. A value that does not fit its type is refused, in the app and over the API.

## Export

**Export** on a code frame downloads a Vite project (React or Svelte) with no feega code in it: every variable becomes its current value, `MemoryRouter` becomes `BrowserRouter`, and npm imports become `package.json` dependencies. `npm install && npm run build` works as is. Choose **values in src/content.ts** to keep the values in one plain constants module instead.

From the CLI: `feega canvas export-code <projectId> <nodeId> [--config] [--out <dir>]`. Over MCP: the `edit` op `export_code_frame` returns the file map.

## From an agent

A code frame is an `iframe` node whose `data` holds `framework` (`react` or `svelte`), `files` (path → source) and `vars` (name → value). A view is an `iframe` node with `sourceNodeId` and `route`. Create or update it with the MCP `edit` tool (`create_node`, `update_node`) or `insert_row` / `update_row`; `describe_node_types` returns the schema.

```json
{ "op": "create_node", "input": { "canvasId": "…", "type": "iframe", "x": 0, "y": 0,
  "data": { "framework": "react", "files": { "App.tsx": "export default () => <h1>Hello</h1>;" } } } }
```

## Limits

- The Properties panel lists the variables of the pages that have rendered: open a view of a page to see its variables.
- Code frames cannot be placed in a motion frame or exported as video yet: motion frames only take generated media, and the motion engine renders its own deterministic components, not live pages.
- Packages load from the network: offline, only code without npm imports runs.
