# Empty-state cards drawn as vectors in core mode

Ads, Calendar and Post preview have no tile of their own: the DOM shows
`EmptyNode` (dashed border, 40px icon box, bold title, hint). Core mode
drew them as a generic source card or a theme-blind snapshot. Now
`card-face` gives them `Surface.Empty` and `core/empty-card.ts` draws the
same layout, icons at 20px/1.6 from the kind icon map. Empty surfaces
ignore snapshots.

SSIM per card, light/dark: Ads 0.951/0.952, Post preview 0.936/0.934,
Calendar 0.983/0.982. Multi-line hints are left-aligned per line where
the DOM centres each line.
