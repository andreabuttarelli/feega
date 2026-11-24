---
title: Focus on a component
description: Open a component in its own tab and try its props and variants.
sidebar:
  order: 11
---

Select an element inside a component and press `F`, or use the focus action on its row in Layers. The component opens in a tab next to Page. `Esc` closes the tab.

## React with Vite

The tab renders the real component, served by your own Vite dev server, with the props it has on the page. Edits in the tab land in the source like edits on the page, and Vite hot reloads the tab.

The right bar gets a Props section at the top:

| Prop type | Control |
|---|---|
| Union of strings | Select |
| Boolean | Toggle |
| String | Text field |
| Number | Number field |
| `children` | Text field |

Callbacks are replaced by no-ops. Objects and arrays are passed as they are on the page but have no control.

**Variants** shows every combination of the select and toggle props in a grid. The grid holds at most 24 combinations. When there are more, the last props are left out and the bar says which. Hover, focus and disabled simulation works on every cell.

The component is wrapped in the providers around your app in the entry file (the `render` call in `main.tsx`), such as a theme, router or query client.

If the component cannot render alone, for example because its provider lives inside `App`, the tab shows a snapshot of the page instead, and says: Couldn't render in isolation: showing a snapshot. The snapshot has no props section.

## Other frameworks

Svelte, Vue, Astro and Next.js show the snapshot: a copy of the live instances, kept in sync with the page.
