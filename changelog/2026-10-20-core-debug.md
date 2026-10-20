# Core canvas: `?coreDebug=1`

Added to chase a frame that goes blank right after a zoom ends (not reproducible locally). With
`coreDebug=1` the core logs `[core]` lines to the console when a gesture ends and whenever the set
of on-screen nodes that are not drawn changes: zoom, view, area, retained-screen size, outcome,
cache bytes, and per node the layer drawn (`core-debug.ts`: real / previous / blocks /
placeholder / none) and why it is not drawn (live editor, not uploaded, not resident,
offscreen). Skipped items reported by the core are logged, window errors and unhandled rejections
are logged, the adapter's max texture size is logged once, and a HUD at the bottom left shows the
same for the node under the cursor. `Painted` now carries the core's `skipped` lines.

Also two compositor tests: a tall frame zoomed to 2-4x draws what is inside the viewport once the
zoom settles, and a cached frame still building when the zoom settles ends up drawn. Both pass,
so the blank-after-zoom is not in the plan stage those tests cover.
