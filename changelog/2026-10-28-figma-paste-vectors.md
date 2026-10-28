# Figma paste: vector loops, linear gradient angle, unfilled frames

Pasting a logo from Figma (fig-kiwi clipboard) showed three defects.

- **Torn vector.** `loopPath` took a loop's first segment as stored. When Figma stores it
  backwards, the second segment did not connect and a new `M` opened mid-loop; the `Z`
  then closed a wedge. The first segment is now oriented by the one after it.
- **Vertical gradient.** `gradientAngle` added 90° for every gradient. That is the CSS
  `from` offset an angular fill needs; a linear fill's angle is its axis direction
  (`cos a, sin a`). Split into `axisAngle` (linear) and `sweepAngle` (angular).
- **Black background.** A Figma FRAME always became a Frame card, whose stage is black by
  design (`frame-source.ts` STAGE). An unfilled frame now lands as a free group, like
  Figma shows it. Filled frames still become Frame cards. Rejected: making the Frame
  stage transparent, which would change every transparent-doc frame.

The SVG-text paste path was already correct; `teta-logo.svg` is added as a fixture guard.
