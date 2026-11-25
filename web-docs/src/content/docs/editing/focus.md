---
title: Focus on a component
description: Open a component in its own tab and try its props and variants.
sidebar:
  order: 11
---

Select an element inside a component and press `F`, or use the focus action on its row in Layers. The component opens in a tab next to Page. `Esc` closes the tab.

## Real component: React, Vue, Svelte, Next.js, Nuxt and Astro

The tab renders the real component, served by your own dev server: Vite, Nuxt and Astro serve it from a page of their own, and Next.js reopens your page inside the tab and renders the component the page already has. React and Vue start from the props the instance has on the page. Svelte and Astro have no way to read them, so they start from the defaults and a placeholder for each prop. Edits in the tab land in the source like edits on the page, and Vite hot reloads the tab.

The right bar gets a Props section at the top:

| Prop type | Control |
|---|---|
| Union of literals (`'sm' \| 'lg'`, `1 \| 2 \| 3`) | Select |
| Boolean | Toggle |
| String | Text field |
| String named like a color (`color`, `fill`, `background`) or holding one | Text field with a color picker |
| Number | Number field |
| Array, tuple | JSON field |
| Object, record, interface | JSON field |
| Date | Date field |
| Callback | Read-only, replaced by a no-op |
| `children`, `ReactNode`, `Snippet`, `VNode` | Text field |

A star marks a required prop. A JSON field keeps the last valid value and flags text that does not parse or has the wrong shape.

Props are read from the types in the source with the same rules in every framework: the props type of a React component (or its PropTypes), `defineProps<{ ... }>()` in Vue (also the object and array forms, `PropType` casts and factory defaults), the destructured `$props()` in Svelte 5, and `interface Props` with `Astro.props` in the frontmatter of an Astro component. Defaults come from the destructuring or `withDefaults`. A type that is declared in another file resolves in React; in Vue, Svelte and Astro a type imported from another file shows a JSON field.

In Next.js the controls are read from the source too, by the same loader that tags your elements, so selects appear there as well. A prop the source does not describe but the page passes still gets a control.

**Variants** shows every combination of the select and toggle props in a grid. Numeric selects vary by their numbers. The grid holds at most 24 combinations. When there are more, the last props are left out and the bar says which. Hover, focus and disabled simulation works on every cell.

In React the component is wrapped in the providers around your app in the entry file (the `render` call in `main.tsx`), such as a theme, router or query client. Vue and Svelte have no providers: a component that needs a plugin such as a router or store shows the snapshot.

If the component cannot render alone, for example because its provider lives inside `App`, the tab shows a snapshot of the page instead, and says: Couldn't render in isolation: showing a snapshot. The snapshot has no props section.

## Next.js

Next.js needs the webpack dev server (`next dev`, not `--turbopack`) and `withFeegaSource` in `next.config`, or Feega starting the server for you. The tab loads your page, hides it and renders the component in a root of its own, so global styles and fonts apply. Props start from what the instance has on the page. The providers in `layout` are not applied: a component that needs one shows the snapshot.

## Nuxt

Vue components in Nuxt work as in Vue on Vite, with props read from `defineProps`. Nuxt components that use composables such as `useRoute` or `useFetch` show the snapshot.

## Astro

An `.astro` component is rendered by your dev server with Astro's container, including its scoped styles. It starts with its defaults and has no Props section. React, Vue and Svelte components used as islands work as in Vite, with props read from the instance when it is hydrated.

## Other frameworks

React Router shows the snapshot: a copy of the live instances, kept in sync with the page.
