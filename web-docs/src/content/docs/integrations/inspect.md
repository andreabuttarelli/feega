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
   radius, opacity, shadow. Under W and H, **min/max** reveals Min W, Max W, Min H and Max H (open
   by default when the element has one). They take px, %, rem, em, vw, vh, dvh and ch, or the
   keywords `none`, `auto`, `fit-content`, `min-content` and `max-content`; scrub or use the arrow
   keys like any number, and `×` clears the value. With Tailwind they write `max-w-[720px]` or the
   theme class when one matches exactly (`max-w-prose`). W and H also take `fit-content` and
   `auto`. At a breakpoint they write `md:max-w-[720px]` or a media query. Closed sections below
   them cover position and inset, display, overflow, aspect ratio, object fit, grid, flex child, per-side border, outline,
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
   An element with `data-*` attributes, `src`, `srcset`, `sizes`, `alt`, `title`, `aria-label`, `placeholder` or
   `poster` gets an **Attributes** section: edit a value and it is written to the source. Only
   literal strings are written; a value built from props or expressions is refused. Changing an image `src` also removes its literal `srcset` and `sizes`, so the new image shows.
   An attribute whose element also has `data-<name>-options="a,b,c"` shows as a dropdown of those
   values. Colour CSS variables the element's rules declare (such as `--ascii-c1`) show as colour
   swatches; a picked colour is written to the element's inline `style`.
7. The **State** menu at the top of Properties shows the element as it looks on **Hover**,
   **Focus**, **Focus visible**, **Active** or, on form controls, **Disabled**, without the mouse.
   A dot marks a state that already has styles, and rows that differ from Default turn blue. While
   a state is chosen every edit is written to it: a `hover:` class with Tailwind, a `.name:hover`
   rule next to the base rule in CSS, CSS modules and Svelte/Vue scoped styles; `×` removes only
   that state's value. States set by JavaScript, `:has()` and CSS nesting are not forced.

   **Impact label.** One line under the breadcrumb says, before you edit, where the edit will
   land. It updates when you select an element and when the scope, state, breakpoint or theme
   changes.
   - **This element only**: the markup is in a file no other file imports, in a page or entry
     file (Next `app/**/page.tsx` and `layout.tsx`, `pages/`, SvelteKit `+page.svelte` and
     `+layout.svelte`, Nuxt `pages/`, Astro `src/pages/`, React Router `app/routes/` and
     `root.tsx`), or in a file imported only by the app entry (`App.tsx` from `main.tsx`) or the
     router. With **This element** scope, a component tag written in its own file also reads this
     way. In a list it reads "This file only · ×N on this page".
   - **Button component · used in N files**: the edit lands in a component's source that N other
     project files import, directly, through an index file that re-exports it (`export { Button }`,
     `export *` or `import X` then `export { X }`), or with an alias such as `@/`, `$lib`, an exact
     `tsconfig` path or the package's own name. Only files that import that component count, not
     every importer of the index file. Tests and stories do not count. The count refreshes when a
     project file is created, changed or deleted. "×N here" is the number of instances
     on this page. Click the label to list the files; click a file to open it at the usage.
     **Only this one** detaches this instance.
   - **Impact unknown**: Feega cannot tell where the edit lands: the rule would go to a global
     stylesheet, the value is a CSS variable (`var(--x)`), or the class comes from props, `cn()`,
     `cva`, a template string, a conditional or a spread. In Tailwind projects Feega writes into
     the first standalone static string of `cn()`, `clsx()`, `cva()`, a template literal, Vue
     `:class` or Svelte `class={...}` (and the text before the first `{}` of a Svelte class
     string), and refuses with a message when there is none. Hover the label for the reason. Before
     writing, Feega shows a compact diff with **Apply** and **Cancel**; **Don't ask again** turns
     it off (`feegaInspect.previewUnknown`). Local and component edits write immediately.

   **Detach.** **Detach instance** (**Only this one** in the impact label, and the right-click
   menu of the preview and the Layers tree) copies the component file next to the original, named
   after the page or route that uses it (`Button.tsx` becomes `ButtonPricing.tsx`), renames the
   component inside the copy and points only that usage, its import and its tag, at the copy. It
   is one undo step and shows in the diff. It works on React (`.tsx`, `.jsx`), Svelte, Vue and
   Astro, and refuses, saying why, when the component is imported through a re-export, rendered
   in a loop or a dynamic component, when its usage is not in the file of the nearest parent, or
   when that element holds several usages of it.

   **Theme snapping.** In a Tailwind project, dragging or typing a padding, margin, gap, width,
   height, radius or font size snaps to the nearest step of your theme (the Tailwind scale plus
   `--spacing`, `--radius-*` and `--text-*` from your CSS) when it is within 2px or 8%. Tick marks
   under the field show the steps while you drag. Hold **Alt** while dragging, or press
   **Alt+Enter** after typing, to write the exact value. A value that is not on the theme shows a
   small orange dot; its tooltip names the nearest step and a click applies it. Colour pickers
   list your project colours first, and a colour that matches none of them gets the same dot,
   whose click applies the nearest project colour. Projects styled with plain CSS are not snapped.
8. **Design** (D) selects and edits; **Navigate** (N) uses the app normally. The top bar has
   back/forward/reload, the route, a dev server status dot, and device widths (keys 1–4).
9. When text uses a font that is not installed on your machine, not loaded by the page and not
   available from the page's own CSS, Feega shows "*Font* isn't installed or loaded. Text falls
   back to *fallback*." as a notice over the page and under **Font** in Typography. **Load from
   Google Fonts** appears when the family is on Google Fonts: it adds the `@import` to your global
   stylesheet, or a `<link>` to `index.html`, `app.html` or the root layout. **Replace everywhere**
   opens a searchable list of your installed fonts and Google Fonts; the choice rewrites that
   family in every `font-family` and `font` declaration, CSS custom property (including Tailwind
   `@theme`), inline style, `fontFamily` object, Tailwind `fontFamily` config and `font-['…']`
   class of the project (`@font-face` blocks stay), and adds the Google Fonts loading when needed.
   It is one change in the Changes list and one undo. The Google Fonts list is bundled; refresh it
   with `node scripts/google-fonts.mjs`.
10. Cmd/Ctrl+Z restores the file. It never overwrites a change made after the edit.

## Layers, structure and shortcuts

Right-click an element in the preview or a row in Layers for **Duplicate**, **Add as child**,
**Wrap with** (Div, Section, Article, Nav, Header, Footer, Link, Button), **Unwrap** and
**Delete**. Each is a single undo.

Select several elements: Shift-click a Layers row for the range of visible rows, Cmd-click
(Ctrl-click on Windows and Linux) to add or remove one, Shift-click in the preview to add or
remove an element. Delete, Duplicate, Wrap and Unwrap then run on all of them as one edit, undone
with one undo. Wrapping several elements needs adjacent siblings of the same parent; otherwise it
is refused with the reason. Elements that cannot be edited are skipped and listed, the rest
proceed. Styles stay single-element: the Properties controls apply to one element.

| Key | Action |
|---|---|
| Delete / Backspace | Delete |
| Cmd/Ctrl+D | Duplicate |
| Cmd/Ctrl+G | Wrap in a div |
| Shift+Cmd/Ctrl+G | Unwrap |
| Cmd/Ctrl+A | Select the siblings |
| Cmd/Ctrl+C | Copy for agent |
| Enter / Shift+Enter | Select the child / the parent |
| Tab / Shift+Tab | Select the next / the previous sibling |
| Esc | Clear the selection |

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

`npx feega plugin add|remove|list|dev` manages third-party plugins; see
[Write a plugin](/integrations/write-a-plugin/).

## Install the dev build

```bash
cd inspect && npm install && npm run package
code --install-extension feega-inspect-0.1.0.vsix
```

## Limits

- Element picking needs the [source map](/integrations/source-map/). Vite, SvelteKit, React Router,
  Astro and Nuxt apps get it when Feega starts their dev server.
- **Astro and Nuxt cannot attach to a server that already runs.** Feega must start the dev server to
  link elements to your source files. If you attach by address (the Open from URL command or
  `npx feega --url`), Feega refuses and offers **Start with Feega**; `npx feega --url` exits with an
  error. If your own server is already on the port, Feega starts its own on a free one and leaves
  yours running.
- Select, text, style and structure edits are tested on Vite (React, Vue, plain HTML), SvelteKit,
  React Router, Astro, Nuxt and Next.js. Angular, Gatsby and Create React App are not supported.
- `hover:`/`dark:` variants, class expressions and non-literal text are not written.

## Use with your agent

- **Selection sync.** The selected element's source is revealed in a text editor beside Feega with
  its line selected, without taking focus, so coding agents that read the editor selection
  (Claude Code, Cursor, Copilot, Cline, Codex, Gemini CLI) see what you selected. Turn it off with
  the `feegaInspect.syncSelection` setting.
- **Copy for agent.** Right-click the selected element and choose **Copy for agent**, or use the
  link next to the file name in the bar, or right-click a row in Layers. The clipboard gets `file:line`, selector, component, page,
  preview width, and the breakpoint, theme and state when set. Paste it into your agent.
- **Skill tip.** In a project with agent files (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`,
  `.codex/` or `.agents/`) and no Feega skill, Feega shows a one-time tip with
  `npx skills add andreabuttarelli/feega`. In the editor it has **Copy command** and **Don't show
  again**; `npx feega` prints one dim line, once per project. Nothing is sent anywhere.
