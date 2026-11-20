---
title: Plain CSS
description: How Feega writes edits in projects with plain CSS.
sidebar:
  order: 2
---

Without Tailwind, edits go to CSS rules.

- In Svelte and Vue, the rule goes in the component's `<style>` block.
- In React and Next.js, it goes in a CSS module.
- In files with no stylesheet (plain HTML), the fallback is an inline style.

See [CSS modules](/styling/css-modules/) and [Scoped styles](/styling/scoped-styles/) for the component cases, and [`feegaInspect.styling`](/more/settings/) to choose the mode.
