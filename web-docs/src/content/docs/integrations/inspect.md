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
6. A link (`<a>`, SvelteKit, Next or React Router `Link`, Vue `RouterLink`/`NuxtLink`) gets a
   **Link** section: its address (`href`, or `to`) with your project's pages as suggestions, and a
   **New tab** switch that writes `target="_blank"` and `rel="noopener noreferrer"`. Only literal
   strings are written; an address held in a constant is written where the constant is defined,
   and one built from props or expressions is refused. **Events** lists the handlers in the source
   (`onClick`, `onclick`, `on:click`, `@click`) by name or as inline; click one to open its line.
   An element with no click handler can be given **Go to page**, **Open URL** or **Scroll to
   section**: Feega writes a small inline handler (Svelte `goto` with its import, `$router.push`
   in Vue, `window.location` otherwise; Next files become client components). One undo removes it.
7. The **State** menu at the top of Properties shows the element as it looks on **Hover**,
   **Focus**, **Focus visible**, **Active** or, on form controls, **Disabled**, without the mouse.
   A dot marks a state that already has styles, and rows that differ from Default turn blue. While
   a state is chosen every edit is written to it: a `hover:` class with Tailwind, a `.name:hover`
   rule next to the base rule in CSS, CSS modules and Svelte/Vue scoped styles; `×` removes only
   that state's value. States set by JavaScript, `:has()` and CSS nesting are not forced.
8. **Design** (D) selects and edits; **Navigate** (N) uses the app normally. The top bar has
   back/forward/reload, the route, a dev server status dot, and device widths (keys 1–4).
9. Cmd/Ctrl+Z restores the file. It never overwrites a change made after the edit.

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

- Element picking needs the [source map](/integrations/source-map/). Vite, SvelteKit, React Router,
  Astro and Nuxt apps get it when Feega starts their dev server.
- Select, text, style and structure edits are tested on Vite (React, Vue, plain HTML), SvelteKit,
  React Router, Astro, Nuxt and Next.js. Angular, Gatsby and Create React App are not supported.
- `hover:`/`dark:` variants, class expressions and non-literal text are not written.

## Use with your agent

- **Selection sync.** The selected element's source is revealed in a text editor beside Feega with
  its line selected, without taking focus, so coding agents that read the editor selection
  (Claude Code, Cursor, Copilot, Cline, Codex, Gemini CLI) see what you selected. Turn it off with
  the `feegaInspect.syncSelection` setting.
- **Copy for agent.** Right-click the selected element and choose **Copy for agent**, or use the
  link next to the file name in the bar. The clipboard gets `file:line`, selector, component, page,
  preview width, and the breakpoint, theme and state when set. Paste it into your agent.
