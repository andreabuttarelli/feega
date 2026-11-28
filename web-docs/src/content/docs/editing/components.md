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

Components sit in a tree of folders that looks and works like the Layers panel, with `src` left out. A folder that holds only another folder is shown on one row, such as `lib/components`. Folders come first, then components, both in alphabetical order. A number on the right of a component shows how many files use it.

Click a folder or its arrow to open or close it. With a row selected, use the up and down arrows to move, right to open a folder, left to close it or jump to its parent, and Enter to open a component. Feega remembers which folders are open for each project.

Type in the search field to filter by name or folder. Matching folders open on their own and the matching text is highlighted.

## Open one on its own

Click a component to open it in [Focus](/editing/focus/), alone on the grey canvas, the same view you get by double-clicking an instance on the page. The component does not need to be used on the current page.

A component that cannot render alone, because it needs props or a provider, shows a notice and an empty canvas, since there is no instance on the page to copy. Next.js apps have no mount page, so components there are not rendered alone yet; open them from the page where they are used.

## Components canvas

**Open canvas** at the top of the list shows every component, each one rendered on its own with its name above it and cut to the size of the component, on a checkerboard. It has the same zoom, pan and fit controls as the [Pages canvas](/editing/pages-canvas/). The global stylesheets of your root layout are loaded, and props come from the first place the code uses the component with literal values, or else from sample values built from its declared types; a small badge next to the name says which (from code, edited or sample). Expand a component in the list to see every place that uses it and click one to render that example; values the code writes as literals or as constants and imports from local data files are followed without running anything. Props that cannot be known, such as page load data, get inline fields on the card and in the list: type a value (JSON for objects and arrays) and the component renders again. The choices are remembered per project. A frame shows a shimmer and Rendering… while it loads. A component that still cannot render alone shows Needs props, and hovering it shows the error. One that draws nothing, such as a head-only component, shows Nothing to show.

It opens as a view tab named Components canvas, next to the Pages canvas and Focus tabs (see [View tabs](/editing/focus/#view-tabs)). Click a frame to open that component in Focus.

## Live updates

The Pages and Components lists and both canvases follow your files. When you, an AI agent or any other tool creates, deletes or renames a page or a component, the list updates on its own and a new entry is briefly highlighted. Zoom and pan on a canvas stay where they are.

When a file changes, the canvas frames that show it take a fresh snapshot once the dev server has applied the change. For a page, that is the page whose route file changed; for a component, its own file.
