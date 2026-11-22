---
title: Tailwind
description: How Feega writes edits in Tailwind projects.
sidebar:
  order: 1
---

When the project has Tailwind, edits are written as classes in the element's `class` or `className`.

- The matching utility is used. If your theme has a token for the value, the token is used.
- Where no utility matches, an arbitrary value is written, such as `p-[30px]`.
- At a smaller preview width, Feega changes the class that applies at that width: `md:p-8` stays `md:` and `p-4` stays the base.
- Class names built by an expression (`cn()`, `clsx()`, template strings) are not written. Feega says why and points at the line.

Force this mode, or turn it off, with [`feegaInspect.styling`](/more/settings/).
