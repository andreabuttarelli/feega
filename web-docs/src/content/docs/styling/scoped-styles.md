---
title: Scoped styles
description: How Feega writes edits in Svelte and Vue components.
sidebar:
  order: 4
---

In Svelte and Vue without Tailwind, Feega writes a rule in the component's own `<style>` block (`<style scoped>` in Vue). The rule is scoped to the component, so the edit does not leak.
