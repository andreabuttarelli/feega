# Breakpoint views resolve in a worker

After #2234 a breakpoint view still cost ~15 ms per edited frame on the main thread,
mostly one full layout per view. `heldViews` now takes an optional `Later` port: the first
time a frame shows its views they resolve in place, after that every edit asks
`breakpoint-views.worker.ts` and keeps the previous views on screen until the answer lands.
Answers land in edit order; an older one arriving after a newer is dropped. A worker that
cannot start or fails falls back to the main-thread resolve.

The bench now records `edit-busy-<target>.json`: CDP `TaskDuration` from input to patch and
over the whole edit cycle, plus `edit:views-main` / `edit:views-landed` measures.

Discarded: porting the resolver to Rust (layout is ~1 ms of arithmetic; the cost was copies
and repeated layout).
