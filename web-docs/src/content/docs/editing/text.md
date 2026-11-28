---
title: Text
description: Edit text in place and style it with Typography.
sidebar:
  order: 3
---

## Editing the words

Double-click a selected text element and type. The change is written to the markup in your source.

Feega writes text that lives in markup. Text that comes from data, a prop or a constant is refused with a message that points at the line, so you can change it where it is defined.

## Typography

The Typography section covers font family (with a font picker), weight, size, line height, letter spacing, alignment and decoration. The text colour is a layer, like any [fill](/editing/fills-and-gradients/): it can be a solid colour or a gradient.

### Changing the tag

In its own Tag section above Typography, on a plain HTML text element (`h1`–`h6`, `p`, `span`, `label`, `blockquote`, `strong`, `em`, `small`), the picker switches it to another tag of that list. Feega renames the opening and closing tag in your source and keeps the attributes and children. Undo and redo work like any other edit, and the element stays selected. If the element is written inside a component used more than once, a note under the picker says how many uses change. Components and self-closing tags have no Tag section.
