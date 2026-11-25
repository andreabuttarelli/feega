---
title: Focus on a component
description: Open a component in its own tab and try its props and variants.
sidebar:
  order: 11
---

Select an element inside a component and press `F`, or use the focus action on its row in Layers. The component opens in a tab next to Page. `Esc` closes the tab.

## Real component: React, Vue and Svelte on Vite

The tab renders the real component, served by your own Vite dev server. React and Vue start from the props the instance has on the page. Svelte has no way to read them, so it starts from the defaults and a placeholder for each prop. Edits in the tab land in the source like edits on the page, and Vite hot reloads the tab.

The right bar gets a Props section at the top:

| Prop type | Control |
|---|---|
| Union of strings | Select |
| Boolean | Toggle |
| String | Text field |
| Number | Number field |
| `children` | Text field |

Props are read from the TypeScript types: `defineProps<{ ... }>()` in Vue (also the object and array forms), and the destructured `$props()` in Svelte 5, with defaults taken from `withDefaults` or the destructuring. React uses the component's props type.

Callbacks are replaced by no-ops. Objects and arrays are passed as they are on the page but have no control.

**Variants** shows every combination of the select and toggle props in a grid. The grid holds at most 24 combinations. When there are more, the last props are left out and the bar says which. Hover, focus and disabled simulation works on every cell.

In React the component is wrapped in the providers around your app in the entry file (the `render` call in `main.tsx`), such as a theme, router or query client. Vue and Svelte have no providers: a component that needs a plugin such as a router or store shows the snapshot.

If the component cannot render alone, for example because its provider lives inside `App`, the tab shows a snapshot of the page instead, and says: Couldn't render in isolation: showing a snapshot. The snapshot has no props section.

## Other frameworks

Next.js, React Router, Nuxt and Astro show the snapshot: a copy of the live instances, kept in sync with the page.
