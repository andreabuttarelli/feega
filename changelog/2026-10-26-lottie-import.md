# Lottie import

Export to Lottie existed; the way back did not. `importLottie` (`src/lib/motion/import-lottie.ts`) reads a Lottie JSON or the first animation of a dotLottie zip into a `MotionDoc`: the frame takes the Lottie width, height and frame rate, each shape becomes a path clip with its fill, stroke or gradient, solids and image layers become rectangles (images are grey placeholders), text layers become Text, precomps become `comps` plus a Precomp clip, path masks become polygon masks, `tt`/`tp` mattes become `matte` + `matteFrom`.

Transforms: a layer with no parent and still groups maps straight to clip keyframes (position, rotation, scale, opacity, the bezier handles and holds kept). Parented layers and animated groups are baked: the matrix is sampled per frame, decomposed with `decomposeLocal` and reduced to the keyframes that matter. The clip box is placed where the layer sits on its first frame, clamped into the frame, so a layer that starts off screen does not break the props ranges; the transform carries the rest.

Not carried over, and listed in `skipped`: trim paths, repeaters, merge paths and other path modifiers, animated paths, animated fills and strokes, gradient strokes, skew, effects, time remap, blend modes, 3D, audio and camera layers. Discarded: reading effects as filters, since the motion effects do not map one to one.

Wiring: dropping or picking a `.json`/`.lottie` file in `+page.svelte` -> page action `importLottie` in `canvas-page.ts` -> `importLottieAt` in `lottie-at.ts` -> `store.create`. Agents use canvas op `import_lottie` (JSON or https URL, fetched with `safeFetchBytes`).
