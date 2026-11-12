# Engine: split a tile render only on overflows the estimate actually measures

#2018 (`engine::overflows`) compared every field of vello's `bump_estimate` with its buffer size.
The estimator measures only lines and segments: it sets `tile` and `ptcl` to 0 and copies the
segment count into `binning` as a loose bound, and the binning buffer is 2^18, eight times smaller
than the segment one. So any batch past 2^18 estimated segments counted as overflowing, though it
fit, and `split_render` halved it again and again, each piece a full plan and draw.

On the landings fixture, one fast zoom sweep: before, 350 batches cost 7,618 `Engine::draw` calls,
42 batches split, one of them into 3,303 draws (zoom 1.68, ~360k estimated segments against a
2^21 buffer); zoom-sweep ran at 13-17 fps with a 24 s frame. After, all seven scenarios: 4,273
batches, 4,273 draws, no split.

`overflows` now checks lines and segments only. A real overflow of either still splits.

Not covered: the estimate ignores the viewport, so off-piece geometry counts in full; at zoom 16
the fixture reaches 1.1M of 2.1M estimated segments. A canvas twice as dense there would split to
the 12-halving limit again (up to 8,191 draws per batch). The binning buffer itself is not
estimated, so a binning overflow still goes unnoticed, as before #2018.
