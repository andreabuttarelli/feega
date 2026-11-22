---
title: SvelteKit
description: What Feega supports in SvelteKit projects, and the limits.
sidebar:
  order: 1
---

## Supported

- Selection, text, and all property sections.
- Styling: Svelte scoped `<style>` blocks, or Tailwind. See [Scoped styles](/styling/scoped-styles/) and [Tailwind](/styling/tailwind/).
- Source mapping through components.

## Limits

- Text that comes from a prop or a constant is refused, with a message.
- Class names built by an expression (`cn()`, `clsx()`, template strings) are not written.
- `{#each}` items cannot be reordered one by one.

## Free templates

Free sections and UI components to start from, in Svelte 5: [Feega templates](https://www.feega.app/templates/svelte).
