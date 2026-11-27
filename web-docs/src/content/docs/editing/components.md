---
title: Components
description: List every component of your project, open one on its own, or see them all on a canvas.
sidebar:
  order: 9
---

The **Components** tab in the left sidebar, next to Layers and Pages, lists every component Feega finds in your project.

## What counts as a component

- Svelte, Vue and Astro files, one component per file.
- React `.jsx` and `.tsx` files that export a capitalized component, one entry per export.

Page and layout files (the ones that make routes, such as `+page.svelte` or `app/page.tsx`), tests and stories are not listed; pages are in the Pages tab. Folders such as `node_modules` and `dist` are skipped.

## The list

Components are grouped by folder, with `src` left out. A number on the right shows how many files use the component. Type in the search field to filter by name or folder.

## Open one on its own

Click a component to open it in [Focus](/editing/focus/), alone on the grey canvas, the same view you get by double-clicking an instance on the page. The component does not need to be used on the current page.

A component that cannot render alone, because it needs props or a provider, shows a notice and an empty canvas, since there is no instance on the page to copy. Next.js apps have no mount page, so components there are not rendered alone yet; open them from the page where they are used.

## Components canvas

**Open canvas** at the top of the list shows every component in a grid, each one rendered on its own with its name above it. It has the same zoom, pan and fit controls as the [Pages canvas](/editing/pages-canvas/), and the same limit of six live frames. Other frames show a snapshot. A component that cannot render alone is drawn as a card with its name.

Click a frame to open that component in Focus.
