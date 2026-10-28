---
title: Brands panel
description: Switch between client brands and drag their material onto the canvas.
sidebar:
  order: 11
---

Open it from the left bar (palette icon, `Alt+3`).

- **Switch brands.** Search by name or slug. Pinned brands (yours, saved to your account) come first, then the brand linked to this project, then every other brand A–Z. The star pins or unpins a brand.
- **Status at a glance.** Each brand shows one line: accounts to reconnect, posts scheduled ahead, nothing scheduled, or no accounts connected. `feega brands` prints the same counts.
- **Kit.** Logo variants (primary, light, dark, mark), palette swatches, fonts by role, voice (tone, do, don't), approved assets, then guidelines, social handles, store and website. Drag any of them onto the canvas to get the matching node.
- **Edit the kit** in project Settings → Brand: logo variants, palette (one `#HEX Name` per line), tone and do/don't rules, a font per role (a Google Fonts family or a font your org uploaded), and which images are approved for the brand. Agents read the same fields with the MCP `query` tool (`brands`, `brand_fonts`, `assets`).
- **Products, Posts, Ads.** The other tabs show the brand's products, its recent posts followed by its best social posts by engagement, and the competitor ads tracked for it. Drag a tile to get an image or video node; items without media become text. The same lists are in `feega library <slug> [products|posts|ads]` and the MCP tool `get_brand_library`.
- The panel opens on the project's own brand when it has one.
