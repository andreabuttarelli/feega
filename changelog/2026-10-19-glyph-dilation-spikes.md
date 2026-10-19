# No spikes on dilated glyphs

Mac-style stem darkening (`dilated`) pushes each outline vertex along the bisector of its two
edges. Flattened glyph outlines repeat a point where two curves meet; the zero-length edge gave a
zero normal, the bisector fell back to one edge and the push hit the 4× miter cap, so every curve
join grew a small triangle — invisible at 1×, obvious at 400% on the canvas core. Repeated points
are now dropped before pushing, in the TS painter and in the Rust port (`gpu-text`), and the
native parity fixture is regenerated.
