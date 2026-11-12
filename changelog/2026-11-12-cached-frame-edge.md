# Engine: cached frames keep a solid last column and row

A cached frame is rastered at a rung scale (2^(k/4)) into `ceil(size × scale)` texels, but both the
raster and the image drawn from it used the rung scale itself: the content covered only part of the
last texel column and row, and stretching it back drew a faded 1 px right and bottom edge (74%
coverage at scale 3 → rung 3.36, 336.4 of 337 texels). `groups.rs filling` now scales the content
to fill the texels exactly on each axis, and the drawn image undoes the same per-axis scale.

`tests/cache.rs`: the old "cached = expanded within 2" test mixed this bug with the resampling
from rung 3.36 to 3 that caching implies; it now runs at a rung scale (2), and a new test checks
the last column and row at scale 3 (was 88, now ≤ 2).
