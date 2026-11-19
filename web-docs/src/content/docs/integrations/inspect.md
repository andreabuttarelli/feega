---
title: Feega Inspect
description: Click an element of your running web app inside VS Code, Cursor or Windsurf and edit its design; the change is written to your source.
sidebar:
  order: 3
---

Feega Inspect is a small editor extension, separate from the Feega canvas. No account, no cloud.

1. Open the folder of your web app.
2. Run **Feega Inspect: Open the running app** from the command palette. The extension starts the
   app's dev server (the `dev`/`start` script it detects) and shows the page in a panel.
3. Click an element. The right bar shows its tag, the component and `file:line` (click it to open
   the source), and the Properties controls: auto layout, size, spacing, typography, colour,
   radius, opacity, shadow.
4. Change a value. With Tailwind, the one class that owns it is rewritten (or your own theme
   token). Without Tailwind, the value is written as CSS in the element's `style` attribute. The
   panel shows "Saved to file:line", or the reason a write was refused.
5. Double-click a text to rewrite it in place: Enter saves, Esc cancels. Text that comes from an
   expression or a data file is not rewritten; the panel links to where it comes from.
6. **Design** (D) selects and edits; **Navigate** (N) uses the app normally. The top bar has
   back/forward/reload, the route, a dev server status dot, and device widths (keys 1–4).
7. Cmd/Ctrl+Z restores the file. It never overwrites a change made after the edit.

## Install the dev build

```bash
cd inspect && npm install && npm run package
code --install-extension feega-inspect-0.1.0.vsix
```

## Limits

- Element picking needs the [source map](/integrations/source-map/). Vite, SvelteKit and React
  Router apps get it automatically; Next.js, Nuxt, Astro and others need `feega-source-map`
  added to their config.
- Element picking: Vite-based apps (SvelteKit, Vite, React Router) only, for now.
- `hover:`/`dark:` variants, class expressions and non-literal text are not written.
