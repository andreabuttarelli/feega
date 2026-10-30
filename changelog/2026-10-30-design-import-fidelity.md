# Design import fidelity (Figma scene, still export, group stacking)

Groundwork for the URL import fidelity work (`2026-10-30-url-import-fidelity.md`); the Figma
importer gets the same gains.

- Gradients: linear angle measured in pixels, not in the unit square (a 135° gradient on a wide
  box kept 135°); radial keeps centre and reach; transparent stops keep their alpha (`#rrggbb00`);
  more than 8 stops are sampled down instead of rejecting the fill. REST radial/angular handles use
  the centre-based frame Figma uses.
- Text: a colour with alpha stays see-through; underline/strike, variable axes and OpenType
  features pass through; weights like 510 stay 510; px line height and letter spacing scale with
  the frame like the size (they were half size on 2× frames); a wrapping text inside auto layout
  keeps its width (only its height hugs).
- Images: fit (fill/fit/stretch) and focus pass through to the image fill.
- Frames: opacity of an unpainted frame is applied to its group; a frame that clips without paint
  still clips (children parented to a transparent container, so the crop has a box).
- Still design frames size with the design limits (16 384 px a side), not the video ones; pen
  shapes keep hairlines (min side 0.00002 of the frame instead of 0.001, which made 1 px rules
  14 px on long pages).
- `flattenComps`: a group sharing a track with plain clips is drawn between the clip before and
  the clip after it (it was drawn above all of them). Scene sequencing now sorts by `from`
  ascending to keep "later scene on top".
- Background blur is clipped to the layer box in the HTML renderer (it blurred the whole frame
  and, on tall frames, painted it white).
- Still export of frames taller than 2 048 px renders in bands with a band-sized viewport and the
  stage translated: a full-height viewport dropped composited layers (hundreds of
  `will-change` layers the size of the frame).
- `pathData` no longer throws on a closed contour of one point.

Discarded: rasterising tall stills through `captureBeyondViewport` (it resizes the viewport and
the player re-lays out); a larger GPU memory flag (no effect).
