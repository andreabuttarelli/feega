# Core canvas cards draw the tile picture, not a sketch

With `?renderer=core`, node cards were a hand-drawn sketch (`cards.ts`): in dark theme the panel
took the canvas paper token and came out black, and generate nodes showed only their output media
— the real UI (prompt, model, buttons) appeared only on hover, when the DOM tile took over.

Cause: the tile snapshot pipeline in `GpuFlow.svelte` ran only with a `scene` (the WebGPU/Pixi
renderer). In core mode `scene` is null, so no card was ever pictured.

Now the pipeline also runs in core mode; a snapshot becomes a blob URL passed as `CardTile.shot`,
and `cardItems` draws it over the whole card. The sketch stays as the stand-in until the picture
lands. Left out: the hovered card briefly shows grey blocks while its new group is put — that
belongs to `CoreFrames` residency, edited elsewhere.
