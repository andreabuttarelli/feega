---
title: Responsive editing in Feega Inspect
description: Edit a design at one breakpoint of your running web app; Feega Inspect writes a prefixed Tailwind class or a media query rule.
sidebar:
  order: 4
---

Feega Inspect reads your project's breakpoints, maps the preview width to one of them and writes
each edit to that breakpoint only.

## Where the breakpoints come from

In this order:

1. Tailwind v4: `--breakpoint-*` variables in `@theme`, added to the defaults. `--breakpoint-*:
   initial;` drops the defaults.
2. Tailwind v3: `theme.screens` in `tailwind.config`, which replaces the defaults, or
   `theme.extend.screens`, which adds to them. Only `px` and `rem` values are read.
3. Media queries with `min-width` or `max-width` found in the project's `.css` files. Each width
   is a breakpoint named after it (`768px`).
4. Tailwind's defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.

A project whose media queries are mostly `max-width` is desktop-first: its breakpoints mean
"this width and below". Every other project is mobile-first: "this width and above".

## Choose where an edit lands

The badge at the top of Properties shows where the next edit is written, for example
`editing: md ≥ 768px`. Click it to choose:

- **Follow the preview**: the breakpoint that matches the preview width. Pick a size in the
  device bar, or drag the frame edge, and the badge follows. Below the smallest breakpoint the
  edit is written as the base value. On the **Full** size the preview is not a device, so an edit
  keeps going to the breakpoint where the value already applies, and the badge reads
  `editing: auto`.
- **All sizes**: the base value, whatever the preview width.
- A breakpoint by name.

## What is written

| Project | Breakpoint | All sizes |
|---|---|---|
| Tailwind | `md:p-5` (desktop-first: `max-md:p-5`) | `p-5` |
| CSS in `.svelte`, `.vue`, CSS modules, stylesheets | `@media (min-width: 768px) { .hero { padding: 20px } }` (desktop-first: `max-width`) | `.hero { padding: 20px }` |

Editing a breakpoint again updates its own class or rule and leaves the others. A state such as
Hover combines with it: `md:hover:bg-red-500`. A file with no stylesheet (inline `style` only)
cannot hold a breakpoint rule and the edit is refused with the reason.

## Overrides

With Tailwind, a small blue dot on a property means a class sets it at a breakpoint. Hover the
dot to see which ones. Values shown in the controls are the ones the page computes at the
current preview width, so they already include the overrides that apply there.

## Hidden layers

A layer whose element has `display: none` at the current preview width shows a crossed-eye icon
in the Layers panel.

## Not covered yet

Overrides written in CSS rules are not marked with a dot, and container queries are not read.
