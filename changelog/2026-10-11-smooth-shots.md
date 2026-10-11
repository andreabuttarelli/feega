# Shots: seek check noise, frame jumps, sandbox localStorage error

## Seek check failed ShotStatCount ("state leaks between seeks")
Not the component. Reproduced only in real Chrome (`channel: 'chrome'`, what the
eval uses), ~50% of runs: a revisited frame differed by ≤3 luma levels on ~30
pixels of one glyph — Skia antialiasing depends on glyph-cache history, and the
verdict compared JPEG data URLs byte for byte. Now `runCheck` decodes each shot
to luma (`luma` port, `luma-decode.ts`) and `verdictOf` treats a revisit as the
same frame when no pixel moves more than 12 levels. A real leak moves far more.

## Frame jumps in shot previews
Measured with the export meter (`probeOf`) on the export capture path, every
shot × 9:16/16:9 (`tests/e2e/motion-shots.spec.ts`, now 0 jumps each):
- the meter itself downscaled with default smoothing: aliasing on moving text
  produced false flickers. `imageSmoothingQuality = 'high'`.
- kinetic title / tagline: words and rows punched in on expo-out (≈80% opacity in
  one frame) with a 2.7-frame stagger → jagged diffs. Now in-out curves, wider
  overlap (`glide`, quint in-out, for the line reveal).
- ui-focus / ui-morph: zooming out showed the black paper around the UI sheet;
  its edge swept across in one frame. Root now takes the UI background; camera
  moves use `glide`.
- stat count: digits changing every frame read as flicker; now six vertical
  rolls between intermediate values.
- whip zoom: flood fade on `glide`; filter always set; zoom starts at the cut.

## SecurityError: localStorage in sandboxed frames
Came from the e2e/eval harness, not the product: `signInE2e`'s init script ran
in every frame, including the opaque-origin preview iframes. Now `skipTour`
writes only in the top frame.
