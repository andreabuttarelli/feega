# Canvas debug log: groups, order, tiles

Follow-up to the debug log. Lines are buffered 100 ms and flushed in time order; each frame gets a
`console.groupCollapsed` with step durations when first drawn; asset tier switches log under
`[images]`; `[tiles]` is derived from what JS already sees each frame (render tally, cache bytes,
pending, motion) rather than a new wasm channel: gesture and rest render start, raster passes,
evictions, settle. A wasm-side event channel was discarded: it needs a gpu-core rebuild for data
the tally already carries. Per-tile raster events stay out until the engine reports them.
