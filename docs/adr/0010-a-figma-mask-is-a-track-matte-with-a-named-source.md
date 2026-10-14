# A Figma mask is a track matte with a named source

Context: frames already mask in two ways. Each clip carries its own AE-style masks (`mask`,
`maskStack`: rect, ellipse, polygon, picture, text, gradients). And a clip can take a track matte
(`matte`: alpha / luma, inverted) from the clip on the track directly above it; the page renders
that source, snapshots it, and uses the pixels as a CSS mask on the target (`hyperframes/mattes.ts`),
so preview, still and video read the same pixels. What is missing is Figma's gesture: draw a
shape, select it with the layers above it, "Use as mask". The shape's fill alpha cuts every one of
those layers, and the shape itself is not painted.

Decision: a Figma mask is a track matte whose source is named, not found. One optional clip
field, `matteFrom` (a clip id at the same level), on each masked layer. With it, `matteSource`
returns that clip instead of the clip on the track above; without it, nothing changes. "Use as
mask" picks the bottom-most selected clip as the mask and sets `matte: alpha`, `matteFrom: <mask>`
on the others; "Remove mask" clears both on every member. A clip is a mask exactly when some clip
names it — no flag on the mask that could disagree with its members.

What follows for free from the existing matte:

- Any fill: the source is rendered, so corner radius, smoothing, paths and gradient alpha (a soft
  mask) all mask as drawn.
- Animation: the snapshot is taken at every seek, so the mask's keyframes move the mask.
- The mask is hidden (`matte-src`), so its fill is not painted.
- One renderer: `composeHtml` and the matte runtime, for the editor, the still and the video.

Masking on/off is the mask's own `hidden`: a hidden clip leaves the doc before compose, the pair
has no source, and the members draw unmasked — Figma's eye on a mask does the same.

Discarded:

- **A mask-group container** (a precomp holding the mask and its layers). It moves clips into a
  comp, so their ids, coordinates and keyframes change on every mask/unmask, and dragging a layer
  in or out of the group becomes a comp edit. The Layers panel can show the grouping without it.
- **A third mechanism** (an SVG `<mask>` built from the shape's geometry, like the per-clip masks).
  It would re-implement fills, gradients and path smoothing for the mask, and drift from how the
  shape actually draws.
- **A list of members on the mask.** Two places would say who is masked; one of them would lie
  after the first drag.

Limits: masks work among the clips of the frame's top level, not inside a precomp. A mask that
ends before its member leaves that member blank, as a track matte does. Moving the mask row in
Layers does not carry its members along.
