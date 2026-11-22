---
title: Settings
description: Every Feega setting and command.
sidebar:
  order: 1
---

In VS Code, settings are under `feegaInspect.*`. With `npx feega`, they live in `.feega/settings.json` in the app folder.

| Setting | Default | Values | Meaning |
|---|---|---|---|
| `feegaInspect.styling` | `auto` | `auto`, `tailwind`, `css` | How style edits are written. Auto: Tailwind classes when the project has Tailwind, otherwise CSS in the component style block (Svelte, Vue), or an inline style in files without a stylesheet (JSX, HTML). |
| `feegaInspect.devCommand` | empty | command | Command that starts the dev server. Empty: detected from `package.json`. |
| `feegaInspect.defaultSize` | `full` | `full`, `desktop`, `tablet`, `phone` | Device size the preview opens at. |
| `feegaInspect.keepServerAlive` | `10` | `0`, `10`, `30`, `60` | Minutes the dev server Feega started stays warm after the panel closes. `0` stops it on close. Closing the window always stops it. |
| `feegaInspect.telemetry` | `true` | boolean | Anonymous usage counts. See [Privacy](/more/privacy/). |

## Commands

| Command | What it does |
|---|---|
| Feega: Open from current workspace | Starts the dev server and opens the app. |
| Feega: Design this folder with Feega | Same, from a folder in the Explorer. |
| Feega: Design this page with Feega | Same, from a `.svelte`, `.vue`, `.tsx`, `.jsx`, `.astro` or `.html` file. |
| Feega: Open from URL | Attach to an app already running at a URL. |
