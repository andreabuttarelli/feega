# Core canvas: lighter video cards, custom-component reads that never stall

- **Video cards.** The canvas `createMedia` asks for `preload: 'metadata'` (`VideoPreload`):
  the browser fetches only the ranges the still frame needs instead of buffering whole files.
  The editor keeps `auto`, it plays them.
- **Cards fetch media only on screen.** Off-screen cards stay placeholder blocks; their images
  and videos load when a card enters the viewport, at the `assetTier` size.
- **Custom-component DOM reads** run through `readPool`: two at a time, the waiting read
  nearest the viewport centre first (distance measured when a lane frees), 8 s per read.
  A read that times out aborts, its reader is disposed and the lane goes to the next frame.
  Before: one at a time, 60 s each, so a hung probe held every custom frame behind it.

Left: a probe whose iframe never fires `load` is abandoned on timeout but its iframe stays
mounted until the page closes.
