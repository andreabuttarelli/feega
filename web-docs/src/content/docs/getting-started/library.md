---
title: Library
description: Insert sections, components and app screens from the Feega Library into your project.
sidebar:
  order: 5
---

The Library holds free sections, components and app screens. Everything is bundled with the extension: no network, no sign-in.

## Insert an item

1. Select an element in the preview.
2. Open **+ Add** in the Layers header and choose **Library**.
3. Search, or pick Sections, Components or App. Switch the thumbnails between Light and Dark.
4. Click **Insert** to place the item after the selection, or drag it onto the preview and drop where the line shows.

One insert is one undo step.

## What gets written

| Project | Component folder | Import |
|---|---|---|
| SvelteKit | `src/lib/components/feega/` | `$lib/components/feega/Name.svelte` |
| Svelte (Vite) | `src/lib/components/feega/` | relative |
| React, Next.js | `src/components/feega/` | relative, named |
| Vue | `src/components/feega/` | relative |
| Nuxt | `components/feega/` | none, auto-imported as `FeegaName` |
| Astro | `src/components/feega/` | relative, in the frontmatter |

- The component file for your framework, plus its stylesheet on React.
- `tokens.css` once, imported from your global stylesheet. With no global stylesheet, the component imports it.
- The Google Fonts the item uses, once.
- The import and the usage at the drop point.

If a different file already has the item's name, the new one is suffixed (`Pricing2`). Inserting the same item again reuses the file. On Next.js, stateful items get `"use client"`.

## Pro items

Items marked **Included in Feega Cloud** are shown locked. Everything else is free.
