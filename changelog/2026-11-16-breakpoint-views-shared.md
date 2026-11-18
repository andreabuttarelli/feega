# Breakpoint views reuse what an edit did not touch

Every edit to a frame with breakpoints re-resolved its views from scratch: `resolveAt`
rebuilt every clip and every component, so the laid-out components and the instance
content were recomputed too, and `withContentHeight` laid out the whole view a second
time after `withFittedInstances` had just done it.

Now:

- `resolveAt` memoises the resolved clip, track and components per source object and
  view scaling; an unchanged clip comes back by reference.
- Laid-out components and instance content are cached per components object and size.
- The boxes of a track list are held per array, so fitting and content height share one
  layout.

Landings, Node, per edited frame (2 views): ~35 ms → ~15 ms (`resolveAt` 15 → 3,
content height 11 → 3.5; fitted instances unchanged at ~8, a full layout of the view).
Output identical to the previous resolver on every checked view.

Considered and dropped: porting auto-layout to Rust. A whole root-tree layout costs
~1.3 ms per edit; the cost was in copies, not in arithmetic.
