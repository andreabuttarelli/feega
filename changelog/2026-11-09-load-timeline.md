# Load timeline overlay and vectors before images

`?loadTimeline` on a canvas opens a panel (`LoadTimeline.svelte`) built
from the `frame|<step>|<group>` performance marks plus resource timings
(`load-report.ts`): page ready, `/sources` requests (start, end, bytes), per
frame asked → source → built → vectors/whole → put → pictured → drawn,
thumbnail shown, images per frame (count, bytes, last byte), and the
milestones all-vectors and sharp. "copy as JSON" gives the raw report, so a
slow real canvas (remote Supabase and storage) can be measured where the
local bench can't.

Screen order is now vectors → images: images still download and decode as
soon as a frame is built, but a frame's image version waits (`VectorGate`)
until every on-screen frame has shown its vector version or thumbnail.
The gate opens after 8 s regardless, so a frame that never builds cannot
hold images back forever. `BENCH_CASE=load` reports `allVectorsMs`.
