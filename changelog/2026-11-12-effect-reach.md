# A filter with its own region reaches only as far as its primitives spread

Every effect (`effects/registry.ts`) emits its SVG filter with its own region, `x/y -25%`,
`width/height 150%`. `filters::svg_reach` answered `None` for any filter with its own region, so
`layers::inflated` had no bounds: the item was never culled off a tile (`off_frame`), its layer
covered the whole tile (`region`), and `groups::shade_reach` laid every child of a filtered group
into every tile. Far in on the landings fixture each tile painted four full-tile layers for
buttons it did not show.

The empty-group analysis from `paints_from_nothing` becomes a spread analysis, `Ink`: `Blank`,
`Within(px)`, `Anywhere`. Each primitive has one rule in `ink_of`: blur grows by 3σ, offset by
its shift, dilate by its radius, `feComposite in` takes the narrower input, merge and `over` the
wider, flood, turbulence, lighting, arithmetic and alpha-lifting matrices reach anywhere, tile,
warp and displacement move pixels anywhere. A filter with its own region now reaches the spread
of its graph from the source; one that reaches anywhere still reaches the whole frame. Filters
without their own region keep the default 10% share.

The bound covers everything the engine draws (the 3σ cut is the one CSS blur and drop-shadow
already use), so stills at rest are unchanged.

Measured (landings, 3 runs each against #2044): far-in level→sharp p95 50 → 34 ms, far-in frames
over 11 ms 12 → 7, zoom-sweep frames over 11 ms 65 → 53. Stills at rest: 1–2 pixels per screen at
zoom 2 and 4 differ by 1/255 in the shadow tail of a dark button: the layer now starts at the
item's reach box instead of the tile corner, which shifts the decimated blur's sample grid.
