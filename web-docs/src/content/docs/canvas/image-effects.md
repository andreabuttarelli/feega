---
title: Image effects
description: Transform an image with a stack of live effects.
sidebar:
  order: 16
---

The **Effects** node transforms an image with a stack of effects (pixel, ASCII, dither, glitch, duotone and more) and a live preview.

1. Add an **Effects** node from the bottom bar and wire an image node (uploaded or generated) into it. Until applied it shows the linked image labelled "Not applied".
2. Click **Open editor** or double-click the node. Preview on the left, stack on the right; **Before** and **After** compare.
3. Pick an effect from **Add effect**: it joins the bottom of the stack with default values. Effects run top to bottom, so order matters; reorder with the arrows. The eye disables an effect keeping its values, the bin removes it.
4. **Apply** renders the full-resolution image and stores it; the node shows it and passes it downstream. **Cancel** closes without saving.

If the upstream image changes, the node shows **Input changed - Reapply**: reopen the editor and apply again.
