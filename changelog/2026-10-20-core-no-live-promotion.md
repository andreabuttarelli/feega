# Core canvas: no automatic hand-over of frames to the DOM

`domIds` promoted motion frames to the live DOM layer on its own (`domPainted` for frames without
a poster asset, `softPosters` once the view rests, #1012). With the core on, a promoted frame was
then removed from the core by `hidden` (#1022), so a frame the DOM layer did not actually show
vanished a moment after a zoom ended. The core draws frames as vectors, sharp at any zoom, so in
core mode both automatic promotions are off; selection, sticky, hover and focus still hand a frame
to the live editor.

Reported from the user's canvas: visible during the zoom, empty right after. Not reproduced here
(the heavy canvas' frames are core-drawn, which `softPosters` already skipped), so this is the
reported lead applied, not a verified repro.
