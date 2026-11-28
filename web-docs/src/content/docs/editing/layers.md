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

Switch the left sidebar from Layers to Pages to list the routes of your app. Click a page to open it in the preview; the page you are on is highlighted.

Feega reads the file-based routes of SvelteKit (`src/routes`), Next.js (`app/`, `pages/`), Astro (`src/pages`) and Nuxt (`pages/`). Dynamic routes such as `/blog/[slug]`, `[...rest]` or `[[lang]]` are listed as a group with example pages underneath, up to ten with a "more" button. Click an example to open it. Examples come from four places, merged without repeats: routes you already visited in the preview that match the pattern, same-origin links found in the pages you load, values you type, and your source. Feega reads the source as soon as Pages opens and again when files change: literal links (`href="/blog/hello"`, `goto('/blog/hello')`, Markdown links) and prerender lists (`entries` in SvelteKit, `generateStaticParams` in Next.js, `getStaticPaths` in Astro) that are literal or map over a list imported from a local file. A dynamic route with no example shows a field per parameter (`slug =`); press `Enter` to add the page. Typed values are remembered per project. Feega never runs your project code to find examples, so a list built by a function call or a database query shows no examples from source. For other setups, such as a React Router config, Pages shows the routes you have visited in the preview.
