# Bracket gradient template

Hand-made template: a thin centred sentence on a soft mesh gradient (five radial blobs on a
light base, drifting on closed circles so the loop is seamless), framed by four small square
corner marks that open from the centre (expo in-out, no overshoot) while the words enter with
the shared word entrance. Words leave, marks collapse back to the centre for the loop.

- Gradient is stacked CSS radial gradients, no blur filter, no WebGL.
- Brackets frame the measured text box; text wraps within `maxWidth` so 9:16 works.
- Render 16:9: 0 jolts.
