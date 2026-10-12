# Studio memory: the next video starts from the last one

When the director opens a new video in a project that already has one,
its brief gets a note derived from the most recently updated other motion
video: style, reference type scale and palette, fonts, Shot* components
used, music asset names (`studioMemory` / `memoryNote` in
`src/lib/motion/studio-memory.ts`, read by `projectMemory`).

No new table or column: the memory is the previous doc itself, so it is
always current and survives anything the doc survives. Per-brand memory
across projects is not built; the project is where a brand's videos live
today.
