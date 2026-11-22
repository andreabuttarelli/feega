---
title: Next.js
description: What Feega supports in Next.js projects, and the limits.
sidebar:
  order: 3
---

## Supported

- Selection and all property sections, with Turbopack.
- Styling: CSS modules or Tailwind. See [CSS modules](/styling/css-modules/) and [Tailwind](/styling/tailwind/).

## Limits

- Text from props or constants is refused with a message.
- Class names built by an expression (`cn()`, `clsx()`, template strings) are not written.
- Layers may list framework wrapper nodes besides your own elements.

## Free templates

Free sections and UI components to start from, in React: [Feega templates](https://www.feega.app/templates/react).
