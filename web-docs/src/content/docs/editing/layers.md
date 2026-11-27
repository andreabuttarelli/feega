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

Feega reads the file-based routes of SvelteKit (`src/routes`), Next.js (`app/`, `pages/`), Astro (`src/pages`) and Nuxt (`pages/`). Dynamic routes such as `/blog/[slug]` are listed with a "dynamic" tag and cannot be opened from the list. For other setups, such as a React Router config, Pages shows the routes you have visited in the preview.
