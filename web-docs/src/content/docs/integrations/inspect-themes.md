---
title: Themes in Feega Inspect
description: Preview your app in each theme it supports and write edits to that theme only; Feega Inspect writes a dark variant class or a theme rule.
sidebar:
  order: 5
---

Feega Inspect reads the themes your project really supports, lists them in the toolbar next to
the device size and writes each edit to the theme you are looking at. A project with no theme
shows no theme control.

## Where the themes come from

The list is built from the project. **Default** is always there; nothing else is added unless the
project supports it, so a project with no dark mode has no Dark entry.

| Source | Theme |
|---|---|
| Tailwind v3 `darkMode: 'class'`, `'selector'` or `['selector', '[data-mode="x"]']` | `dark`, on the class or attribute you configured |
| Tailwind v3 `darkMode: 'media'`, or v4 without a custom variant, when the code uses `dark:` | `dark`, from the system setting |
| Tailwind v4 `@custom-variant name (...)` | `name`, on the class or attribute it selects |
| `@media (prefers-color-scheme: dark)` or `light` in a `.css` file | `dark` or `light`, from the system setting |
| `.dark`, `.light`, `.theme-x`, `[data-theme="x"]`, `[data-mode]`, `[data-color-scheme]`, `[data-bs-theme]` selectors in a `.css` file | One theme per class or value |
| daisyUI `themes` in `tailwind.config`, or in `@plugin "daisyui"` | One theme per name; `light` and `dark` when none are listed |
| `next-themes` | Its `themes` (default `light` and `dark`), on its `attribute` (default `data-theme`) with its `value` map |
| `mode-watcher` | `dark`, on the `dark` class |

When two sources name the same theme the framework wins over the stylesheet.

## Switch the preview

Choose a theme from the **Theme** menu in the toolbar. The preview shows it at once and keeps it
across reloads and hot updates.

- A class or attribute theme is set on the page's `<html>` element. **Default** puts back what the
  page had.
- A theme from the system setting is emulated: Feega Inspect makes the page see
  `prefers-color-scheme` as the theme you chose, in its CSS and in `matchMedia`, without touching
  your operating system.

## Edits go to the theme

While a theme other than Default is on, the badge at the top of Properties adds `theme: dark`
next to the breakpoint, and every edit is written to that theme only.

| Project | Theme `dark` | Default |
|---|---|---|
| Tailwind | `dark:p-5`, with a breakpoint `md:dark:p-5`, with a state `md:dark:hover:p-5` | `p-5` |
| CSS in `.svelte` | `:global(.dark) .hero { padding: 20px }` | `.hero { padding: 20px }` |
| CSS in `.vue`, stylesheets | `.dark .hero { padding: 20px }` | `.hero { padding: 20px }` |
| CSS modules | `:global(.dark) .hero { padding: 20px }` | `.hero { padding: 20px }` |
| System setting | `@media (prefers-color-scheme: dark) { .hero { padding: 20px } }` | `.hero { padding: 20px }` |

An attribute theme uses its attribute in place of the class: `[data-theme="forest"] .hero`. With a
breakpoint, a system theme joins both in one query: `@media (min-width: 768px) and
(prefers-color-scheme: dark)`. Page styles go to the global stylesheet: `html.dark` for the root
and `.dark body` for the body.

Editing a theme again updates its own class or rule and leaves the others. A file with no
stylesheet cannot hold a theme rule and the edit is refused with the reason. With Tailwind, a
theme that has no Tailwind variant, such as a daisyUI theme, is refused: edit it from a stylesheet.

## Not covered yet

Values of CSS variables defined per theme are not edited per theme, and themes set by code the
inspector cannot read (a theme stored in a cookie and applied on the server, for instance) appear
only when a stylesheet or a library above names them.
