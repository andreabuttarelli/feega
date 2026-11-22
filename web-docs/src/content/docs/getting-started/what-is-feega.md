---
title: What is Feega
description: Feega is a free, open-source VS Code extension to design in your codebase.
sidebar:
  order: 1
---

Feega is a free, open-source (Apache-2.0) VS Code extension. It also runs standalone with `npx feega`.

Run your app through Feega, click any element, and edit it like in Figma: text, size, spacing, colour, gradients, radius, shadows, typography, position. Each edit is written to your source files as a diff.

There is no AI and no token in the loop. Feega edits the code the way you would, in the system your project already uses: a Tailwind class, a CSS module rule, a scoped style.

## How it works

1. Feega starts your dev server and shows the running app beside your code.
2. In development, each element is tagged with the file, line and column it came from. A click on the page lands on a line of source.
3. You edit in the right bar. The preview updates, and the file changes.
4. Every edit appears in Changes. You can review, undo or revert it.

## What it supports

- **Frameworks**: [SvelteKit](/frameworks/sveltekit/), [React with Vite](/frameworks/react-vite/), [Next.js](/frameworks/nextjs/), [Vue](/frameworks/vue/), [Nuxt](/frameworks/nuxt/), [React Router](/frameworks/react-router/), [Astro](/frameworks/astro/), [Vite](/frameworks/vite/). See [Supported frameworks](/frameworks/supported-frameworks/) for what is not supported.
- **Styling**: [plain CSS, CSS modules, Svelte and Vue scoped styles, Tailwind](/styling/tailwind/).
- **Editors**: VS Code, Cursor, Windsurf, VSCodium.
- **Systems**: macOS, Windows, Linux.

## Two ways to run it

The same editor runs [inside your editor](/getting-started/install/) as an extension, or in the browser with `npx feega`.

An account is optional. Everything works without one. See [Account](/more/account/).
