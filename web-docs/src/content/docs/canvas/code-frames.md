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
- **Safety.** The code runs in a sandboxed iframe with no access to your session or the app.

## From an agent

A code frame is an `iframe` node whose `data` holds `framework` (`react` or `svelte`) and `files` (path → source). Create or update it with the MCP `edit` tool (`create_node`, `update_node`) or `insert_row` / `update_row`; `describe_node_types` returns the schema.

```json
{ "op": "create_node", "input": { "canvasId": "…", "type": "iframe", "x": 0, "y": 0,
  "data": { "framework": "react", "files": { "App.tsx": "export default () => <h1>Hello</h1>;" } } } }
```

## Limits

- Code frames cannot be placed in a motion frame or exported as video yet: motion frames only take generated media, and the motion engine renders its own deterministic components, not live pages.
- Packages load from the network: offline, only code without npm imports runs.
