# Poster liquid glass template

Swiss two-column type poster on a grey wall; a liquid-glass stream flows over it and refracts the type.

- Refraction needs the pixels under the glass, which CSS/SVG filters cannot bend along a moving free-form outline: one three.js renderer, a fullscreen shader over a 2D-canvas texture of the poster. The existing glass (SVG lens) is a fixed ellipse; the WebGPU catalogue has no refractive blob.
- The glass is a smooth union of capsules between 14 nodes; nodes move on integer-cycle sines, so the loop closes exactly. Pure function of t (`model.ts`, tested).
- Grey lines are marked with a leading `~` in the column text.
