# A thumbnail stays until the frame's vectors are on screen

The cached thumbnail used to be a frame's "loaded" group: `showThumb`
skipped any frame that already had a build listed, and a build listed
after the thumbnail replaced it in `lists`. With the source known early
(IndexedDB source cache, #1895) the build won the race, so the frame sat
on its placeholder from ~1.8 s (thumbnail ready) to ~4.4 s (build put).

Now the thumbnail is its own layer in each frame's chain (`layersOf` in
`placeholders.ts`: built → previous → thumbnail → blocks → placeholder).
The first layer already on the GPU is drawn, so the thumbnail shows until
the built version is actually uploaded, and is dropped once it is.
