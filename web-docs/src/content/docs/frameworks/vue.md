---
title: Vue
description: What Feega supports in Vue projects built with Vite, and the limits.
sidebar:
  order: 4
---

## Supported

- Selection through components and `v-for`, and all property sections.
- Styling: `<style scoped>` blocks, or Tailwind. See [Scoped styles](/styling/scoped-styles/) and [Tailwind](/styling/tailwind/).
- Editing a component updates all its instances.

## Limits

- Text from props or interpolations (`{{ title }}`) is refused with a message.
- Class names built by an expression are not written.
- Items of a `v-for` cannot be moved one by one.

## Free templates

Free sections and UI components to start from, in Vue 3: [Feega templates](https://www.feega.app/templates/vue).
