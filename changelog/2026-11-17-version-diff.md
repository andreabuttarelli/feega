# Visual diff between versions

Step (b) of Compare versions. `changedRegions` (`src/lib/canvas/pixel-diff.ts`) compares two
posters drawn at the same size: a pixel counts when any RGB channel moves more than 24, a 16 px
cell counts when one of its pixels does, and connected cells merge into one box, returned in
fractions of the poster so the overlay scales with it. Different sizes are one whole-poster
region, not a crash.

Pressing the version badge opens `VersionCompare` between the version and its original, or the
other frame when exactly two are selected (`comparedWith`). Overlay draws the boxes on the
version's poster; Slider clips the before poster over the after one.

Considered: a server-side diff. Rejected for now: posters are already in the browser at the
size shown, and a diff of 900 px posters is a few milliseconds.
