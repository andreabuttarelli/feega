# A variable font upload keeps its weight range

An uploaded variable font (one file, `fvar` `wght` 100..900 — e.g. the Inter subset a
Next.js site serves, which a website import files in the org library) was recorded as a
single 400 face: `readFontMeta` read only `OS/2.usWeightClass`. From there every path
clamped the weight: `registerUpload` gave the family `weights: [400]`, `loadedWeight`
turned a 600 Title into 400, and `uploadFaceCss` declared `font-weight:400`, pinning the
file to its default instance. Exports showed semibold titles as regular, and the wider
regular glyphs wrapped lines differently from what was designed. Seen on the v6 trailer
(frame `f21d2835`, Inter 600 everywhere).

Now `readFontMeta` reads the `wght` axis and returns `weight: min, maxWeight: max`. The
range rides in the asset content (no schema change: `org_fonts.weight` stores the min,
`orgFontFiles` reads `maxWeight` from the asset). `registerUpload` lists every weight in
the range and a `wght` axis; `uploadFaceCss` and `orgFontCss` declare `font-weight:min
max`, so the browser and the gpu text engine pick any weight from the one file.

Not done: files uploaded before this keep their single-weight row; re-upload (or delete
and re-upload) them. The title clipping reported with the same render was not reproduced
in a local producer render with the real font and doc props.
