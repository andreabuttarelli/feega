---
title: Feega Inspect
description: Click an element of your running web app inside VS Code, Cursor or Windsurf and edit its design; the change is written to your source.
sidebar:
  order: 3
---

Feega Inspect is a small editor extension, separate from the Feega canvas. No account, no cloud.

1. Open the folder of your web app.
2. Run **Feega: Open from current workspace** from the command palette. The extension starts the
   app's dev server (the `dev`/`start` script it detects) and shows the page in a panel.
3. Click an element. The right bar shows its tag, the component and `file:line` (click it to open
   the source), and the Properties controls: auto layout, size, spacing, typography, colour,
   radius, opacity, shadow. Closed sections below them cover position and inset, display,
   overflow, min/max size, aspect ratio, object fit, grid, flex child, per-side border, outline,
   blend and blur, transform, transition, cursor, text options and list markers. A dimmed value
   is inherited (the ancestor is named next to it); `×` removes the element's own value.
4. Change a value. With Tailwind, the one class that owns it is rewritten (or your own theme
   token). Without Tailwind, the value is written as CSS in the element's `style` attribute. The
   panel shows "Saved to file:line", or the reason a write was refused.
5. Double-click a text to rewrite it in place: Enter saves, Esc cancels. Text that comes from an
   expression or a data file is not rewritten; the panel links to where it comes from.
6. **Design** (D) selects and edits; **Navigate** (N) uses the app normally. The top bar has
   back/forward/reload, the route, a dev server status dot, and device widths (keys 1–4).
7. Cmd/Ctrl+Z restores the file. It never overwrites a change made after the edit.

## In the browser: `npx feega`

The same editor runs without VS Code:

```bash
cd my-app
npx feega            # or: npx feega <dir> --port 4100 --no-open
```

It finds the app (and asks which one when the folder holds several), starts its dev server and
opens the editor in the browser. Edits, undo/redo and the Changes tab behave as in the extension.
Open in editor uses `code -g` when VS Code is on the PATH, else `$VISUAL`/`$EDITOR`, else prints
`file:line:col`. Settings live in `.feega/settings.json` in the app folder. Ctrl+C stops the
editor and the dev server.

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
