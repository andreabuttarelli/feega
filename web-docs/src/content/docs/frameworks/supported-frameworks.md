---
title: Supported frameworks
description: The frameworks Feega is tested on, and the ones it does not support.
sidebar:
  order: 0
---

Select an element, edit it, and the change is written to your source. Each framework below is checked by an end-to-end test on macOS and in CI on macOS, Linux and Windows.

| Framework | Page | Notes |
|---|---|---|
| React (Vite) | [React with Vite](/frameworks/react-vite/) | |
| Next.js | [Next.js](/frameworks/nextjs/) | |
| Vue (Vite) | [Vue](/frameworks/vue/) | |
| SvelteKit | [SvelteKit](/frameworks/sveltekit/) | |
| Nuxt 4 | [Nuxt](/frameworks/nuxt/) | Feega must start the dev server |
| React Router 7, framework mode | [React Router](/frameworks/react-router/) | |
| Astro 5 | [Astro](/frameworks/astro/) | Feega must start the dev server |
| Vite, no framework | [Vite](/frameworks/vite/) | Edits land in `index.html` |

## Dev server

Astro and Nuxt only map elements to source when Feega starts the dev server. Attaching to a server you already started does not map them.

## Not supported

- Angular
- Plain static HTML without Vite
- Create React App

Gatsby is untested.
