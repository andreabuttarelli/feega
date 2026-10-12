# Poster liquid glass template

Swiss type poster on a grey wall: one huge word over an asymmetric grid (small intro/details top, big dates, place bottom left, corner note); a liquid-glass stream flows over it and refracts the type.

- Refraction needs the pixels under the glass, which CSS/SVG filters cannot bend along a moving free-form outline: one three.js renderer, a fullscreen shader over a 2D-canvas texture of the poster.
- The glass is a smooth union of capsules between 14 nodes plus 6 drops. Each drop rides out from an anchor node and back on an integer-cycle pulse (double smoothstep, phase from `seed`), so drops split off and melt back at different moments and the loop closes exactly. Pure function of t (`model.ts`, tested).
- Layout is a table of blocks (`BLOCKS`); a too-long line shrinks its block instead of leaving the poster. The first draft copied the reference's two mirrored columns; replaced with original copy and placement.
- Edge slivers: the rim profile had infinite slope at the outline; now finite, slope capped lower and bend faded at the very edge.
- Grey lines are marked with a leading `~`.
