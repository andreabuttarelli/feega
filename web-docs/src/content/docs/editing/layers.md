---
title: Layers
description: The element tree of your page.
sidebar:
  order: 7
---

The Layers tree shows the element hierarchy of the page. Click a layer to select the element. Each layer has an icon for what it is: text, container, image or icon. Rows can be hidden or locked from the tree. Page and head elements cannot.

Drag a layer to reorder siblings. The change is a swap in your source.

Layers fills in as the app reports its structure. If it looks empty after the app opens, interact with the page or make an edit.

## Pages

Switch the left sidebar from Layers to Pages to list the routes of your app. Click a page to open it in the preview; the page you are on is highlighted. The first row, "Error page", opens a path that does not exist so you can edit your 404 page (`+error.svelte`, `not-found.tsx`, `404.astro`).

Feega reads the file-based routes of SvelteKit (`src/routes`), Next.js (`app/`, `pages/`), Astro (`src/pages`) and Nuxt (`pages/`). Dynamic routes such as `/blog/[slug]`, `[...rest]` or `[[lang]]` are listed as a group with example pages underneath, up to ten with a "more" button, and always a last example marked "404" with a value that cannot exist (`feega-not-found`), which opens your not-found page for that route. Click an example to open it. Examples come from five places, merged without repeats: routes you already visited in the preview that match the pattern, same-origin links found in the pages you load, values you type, your source, and your route generators. Feega reads the source as soon as Pages opens and again when files change: literal links (`href="/blog/hello"`, `goto('/blog/hello')`, Markdown links) and prerender lists (`entries` in SvelteKit, `generateStaticParams` in Next.js, `getStaticPaths` in Astro) that are literal or map over a list imported from a local file. Links in comments, in test, spec, story or fixture files, and placeholder values such as `/wiki/slug` or `/templates/a` are left out. A dynamic route with no example shows a field per parameter, such as "Open with a slug…": type a value and press `Enter` to open the page, or click the dice button at the right end of the field and pick a ready value (slug, id, UUID, number or the not-found value) to open the page with it. Typed values are remembered per project. In SvelteKit and Astro projects, Feega then asks your dev server to run `entries` (including the ones in parent layouts) or `getStaticPaths`, one route at a time, for dynamic routes that still have fewer than ten examples. A list built by a function call or a database query fills in a moment later, and generated examples are listed first. This runs your project code, with a 5 second limit per route; a generator that fails is skipped. Turn it off with the `feegaInspect.routeGenerators` setting ("Run route generators to find examples"). Next.js and Nuxt projects, and apps that Feega attached to without the Feega dev plugin, only use the source pass. For other setups, such as a React Router config, Pages shows the routes you have visited in the preview.
