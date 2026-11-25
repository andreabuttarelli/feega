---
title: Library
description: Insert sections, components and app screens from the Feega Library into your project.
sidebar:
  order: 5
---

The Library holds sections, components and app screens. Free items are bundled with the extension: no network, no sign-in. Pro items need a Feega Cloud plan.

## Insert an item

1. Select an element in the preview.
2. Open **+ Add** in the Layers header and choose **Library**.
3. Search, or pick Sections, Components or App. Switch the thumbnails between Light and Dark.
4. Click **Insert** to place the item after the selection, or drag it onto the preview and drop where the line shows.

The inserted item becomes the selection. One insert is one undo step.

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

Items marked **Included in Feega Cloud** are Pro templates. Their code is not bundled: **Insert** fetches it for your framework with your Feega account, then writes it exactly like a free item.

- Not signed in: Feega asks you to sign in, then you click **Insert** again.
- Signed in without a Feega Cloud plan: Feega says the item is included in Feega Cloud and offers **See pricing**.
- With a Feega Cloud plan: the item is inserted.

Everything else is free.
