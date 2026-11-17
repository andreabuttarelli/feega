# A zoom or pan no longer rebuilds the frames around it

The image tier (256 px below zoom 0.75, 1024 px above) was part of every frame's key
(`tieredKey`). Crossing 0.75, and every frame moving across the Near/Far reach while the camera
moved, gave the frame a new key: `toBuild` asked for it again, `load` re-presented it as a new
group (first `<key>:vectors`, every not-yet-decoded image a `look.line` block), and `stage` dropped
the old group from the core and put the new one whole, mid-gesture. On the 36-page stress canvas
that was 12 frame rebuilds per 10 s of zoom, and the long paced draws were `stage` putting
20k-item groups.

Now the key no longer carries the tier, and the tier is decided in one place, `keptTier`
(`asset-tier.ts`): while the camera moves a loaded frame keeps the tier it has; at rest a near
frame takes the larger of wanted and loaded, a far one the smaller. A tier change at rest is a
picture swap (`swapTier`): the built list is re-pointed at the other rendition (`tierSwap`),
`media.ready` decodes it while the old pictures stay on screen, and only once all are decoded
does the frame's list change under the same group, with its pictures re-uploaded under the same
clip keys (`repictured`). Nothing is re-put; no block is ever drawn for a picture already shown.

The old rendition is not closed on swap: the core may still copy from it while the new one
arrives, and closing it there detached the bitmap mid-copy (gpu-core panic, renderer lost). It
stays cached by `src`, so a frame holds at most both renditions (the 256 px one is 1/16 of the
1024 px) and swapping back costs no decode. Phone eviction (`overBudget`) now waits for rest too.

Considered: keeping the tier in the key and deferring the rebuild to rest. Rejected: the rebuild
still re-puts the whole frame to swap pictures that the core already keys by clip.
