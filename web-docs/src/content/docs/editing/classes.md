---
title: Classes
description: See where a CSS class is used and edit its rule once for every element.
sidebar:
  order: 12
---

The Classes section of Properties lists the classes of the selected element that have a rule in your CSS. It works with plain CSS, CSS modules and the `<style>` of Vue, Svelte, Astro and HTML files. Tailwind utilities are not listed.

## What you see

Each class shows how many elements and files use it, for example `14 elements · 6 files`.

Click a class to open its view:

- Rules: each rule with its file and line, its declarations, and its state or media query.
- Used in: every element that uses it. Click the location to open it in the editor, or Select to pick it on the page.

Used in this file lists the other classes the file of the selected element uses.

A class set by an expression, like a template literal or `clsx` with variables, is marked dynamic. Its counts can miss elements.

## Edit a class

Click Edit next to a class. The bar shows `Editing: .card (global)` and every property control writes into the rule of that class instead of the element. The impact line reads `.card in 14 elements, 6 files`.

An edit to a class used in more than one element opens the preview first, with the diff. Apply writes it. The change appears in Changes as a class edit and can be undone.

The state and breakpoint you pick apply to the class rule too: Hover writes `.card:hover`, a breakpoint writes inside its media query.

Click This element to go back to editing the element.

## Limits

- SCSS, Sass and Less files are not read.
- Counts come from source: an element in a loop counts once.
- A rule with a combinator, like `.list .card`, is shown but not edited.
- The edit goes to the first plain rule of the class. Cascade order between sheets is not resolved.
