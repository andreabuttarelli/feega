---
title: React with Vite
description: What Feega supports in React projects built with Vite, and the limits.
sidebar:
  order: 2
---

## Supported

- Selection with file, line and column, and all property sections.
- Styling: CSS modules next to the component (imported if missing), or Tailwind. See [CSS modules](/styling/css-modules/) and [Tailwind](/styling/tailwind/).
- Sibling reorder writes a clean swap in JSX.

## Limits

- Text from props or constants is refused with a message.
- Class names built by an expression (`cn()`, `clsx()`, template strings) are not written.
- Items rendered by `.map` share one source line and cannot be moved one by one.
- Layers fills in after the first hot update.

## Free templates

Free sections and UI components to start from, in React: [Feega templates](https://www.feega.app/templates/react).
