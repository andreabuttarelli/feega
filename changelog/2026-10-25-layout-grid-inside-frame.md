# Layout grid stays inside the frame

**Before:** a fixed count with min, max or center alignment could be wider than the frame, so bands spilled out and centre-aligned ones were cut off on both sides.

**Now:** non-stretch guides keep only the sections that fit (at least one). Stretch is unchanged: equal margins by construction. Min and max are one-sided on purpose, so the leftover space sits on the far side. e2e checks the overlay matches the frame box at three zoom levels, frame not at the origin.
