# Engine: stop splitting a tile render when its halves share the geometry

#2037 left a hole in `split_render`: vello's bump estimate is taken on the piece's own plan, which
culls whole groups and items outside the piece, but an item that overlaps the piece still counts in
full, off-piece geometry included. When such items fill the estimate past vello's buffers, halving
cannot shrink it, and the batch fanned out to the 12-halving limit: up to 8,191 plan+draw calls for
one batch, the same hang #2018 caused.

`Engine::draw` now reports how full the estimate is (`fullness`, 1.0 = vello's line or segment
buffer), and `split_render` renders both halves of an overflowing piece, then compares them with
it. If the halves together hold at least 1.75x their parent (both see most of the same geometry),
splitting does not help: both halves are kept as they are. Otherwise each overflowing half splits
again.

Bounds, held by `packages/gpu-core/tests/overflow.rs`:

- geometry shared by both halves: 3 draws per batch;
- geometry that halving only pushes into one half (one dense item in a corner): 2 draws per
  halving, at most 1 + 2 x `MAX_SPLITS` = 25;
- geometry that halving separates still splits until every piece fits, covering the batch with no
  overlap.

Rejected: a viewport-aware estimate. The plan already culls per piece; what remains is geometry
inside a single item, and clipping it would mean changing vello's estimator, which counts at
encode time without knowing the target size. Rejected: stopping as soon as one half keeps most of
its parent's estimate. That stops dense content sitting in one half of the piece, which further
halving would separate.

Not covered: content contrived so that every halving shares just under 75% of the geometry for 12
levels can still fan out; it needs an estimate above ~5x vello's buffers in one batch.
