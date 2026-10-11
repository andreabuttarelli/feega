# Seek check: compare JPEG blocks, not pixels; shots taken at the asked time

## ShotStatCount still failed on stripe after #398
Not a leak: the component is a pure function of `t`, and every reply was drawn
at the asked time. Reproduced with the eval's stripe doc
(`tests/e2e/fixtures/stripe-stat-count.json`) in Chromium and real Chrome:
~1 run in 7 a revisit of the mid-roll digit (0.77 s, 2.3 s) differed by 13
luma levels on 4–5 pixels, all inside one 8x8 block. The check frames are
JPEG q0.72: sub-threshold raster noise flips a quantised coefficient and the
whole block moves. A per-pixel tolerance cannot hold that; raising it hides
real leaks.

`verdictOf` now compares 8x8 block means (the JPEG grid) with a 2-level
allowance. Measured: the false positive moves a block mean by 0.25; an edge
one pixel off moves it by ~32. The `luma` port returns the frame width with
the values so blocks can be formed.

Discarded: lossless (PNG) check frames — the offending frames are uploaded to
the agent as small JPEGs, and the frames endpoint refuses anything else.

## Two ways a check shot could show the wrong frame
- An editor reload debounced just before a borrowed capture fired 250 ms into
  it and swapped the check document for the editor's. `load` now cancels the
  pending reload.
- Anything seeking the preview between the shot's seek and its draw (editor
  playhead, player) gave a frame of another time. The capture reply now carries
  the timeline time it drew (`time`), and the driver shoots again when it is
  not the asked one.
