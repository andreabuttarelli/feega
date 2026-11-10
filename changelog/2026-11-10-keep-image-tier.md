# Zooming out keeps a frame's sharper images

`keyOf` followed the asset tier of the current zoom: crossing 0.75 on the
way out asked every frame again at 256 px, a new group replaced the drawn
one, and with tiles on the frame showed only its background until the new
group was rastered. Now a frame keeps the highest tier it has fully drawn
(`keptTier` in `asset-tier.ts`); only zooming in asks for a larger tier.
A frame that has already been drawn also skips the vectors-only stage on a
reload (`shownBefore`): the drawn version stays until the new one is on
the GPU.
