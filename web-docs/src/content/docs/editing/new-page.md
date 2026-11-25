---
title: Add a page
description: Create a page from the editor, blank or from a library section.
sidebar:
  order: 12
---

The plus button next to the route field creates a page. Type a route such as `about` or `blog/first`, pick **Blank** or a free library section, and press **Create page**. Feega writes the file, shows the page and lists it in Changes. Undo removes it.

| Framework | File created |
|---|---|
| Next.js | `app/<route>/page.tsx` (or under `src/app`) |
| SvelteKit | `src/routes/<route>/+page.svelte` |
| Astro | `src/pages/<route>.astro` |
| Nuxt | `pages/<route>.vue`, needs `pages/index.vue` |

React Router, Vite single-page apps and Vue single-page apps declare routes in a router config. Feega does not edit it yet and says so.

A route that already exists, an empty name and dynamic segments like `[id]` are refused. Names are lowercased and spaces become dashes.
