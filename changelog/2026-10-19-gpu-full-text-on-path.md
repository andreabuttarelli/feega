# gpu-full draws text on a path

Text bent along a path was named `text-path` and skipped. gpu-full now places it like the page's
script: each character (whitespace as a space) is shaped alone, its advance includes tracking,
`placeGlyphs` puts its centre at its arc length and turns it with the tangent, and the glyph sits
`-50%, -0.8em` from that point with the browser's line-height-1 baseline. Char animators turn
each character about its own box. The curve and placement come from `textPathAt`, which
`textPathOutline` now shares. Like the page, colour comes from `color`; fills and strokes are not
drawn on a path.

Parity (`kinds.ts on-path`, `--ref=live`, 4 frames): mean SSIM 0.9958, worst 0.9956, ≤0.37% pixels off.
