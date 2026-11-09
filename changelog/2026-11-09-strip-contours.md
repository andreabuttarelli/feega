# Contours cross from the build worker as buffers

At CPU 4x the main thread spent ~0.7 s on open receiving finished display
lists from the build worker: structured clone of every contour as nested
number arrays, plus a JSON wire per item. The worker now moves all
contours into one Float64Array/Uint32Array pair (transferred) and leaves
each item holding a view into them. Items stay plain objects, so staging
(bleed) and placeholder rebuilds on the main thread still work; `itemPack`
copies view floats directly, so a rebuilt item never draws blank.
Group diffs key items on their pack plus a hash of the floats
(`itemKey`) instead of a full JSON spelling of the contours.

Discarded: packing the whole list once in the worker (no gain, the cost
was the object clone); moving staging into the worker (not needed once
items keep views).
