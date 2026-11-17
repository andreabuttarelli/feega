# Canvas: frame header icons

Frames had only a name (truncated already) and a colour-tag dot above them. Status lived elsewhere:
component sets in the outline, breakpoints in the views, prototype links in the arrows.

`frameHeaderIcons` (`src/lib/canvas/core/frame-header.ts`) is the one table of header states:
component, breakpoint, prototype, and seven GitHub states (conflict, orphan, read-only, upstream,
modified, in PR, in sync) kept behind `HEADER_FLAGS.sourceSync` until frames carry a source
binding; of those only the highest-priority one shows. The GPU overlay draws the icons
right-aligned in the label row (`chrome.ts`); `badgesKept` drops icons from the end before the name
falls under three characters plus "…".

Clicks land on transparent DOM buttons (`FrameHeaderIcons.svelte`) with a tooltip each. They go
through `headerHits`, which returns none while the camera moves, so gestures mount and update no
header DOM, as #2271/#2272 do for other chrome.
