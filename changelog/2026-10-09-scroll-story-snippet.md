# Scroll-story snippet produced by feega

**Before:** `hostMain` honoured a `<div data-scroll="N">` wrapper (PR #328), but `embedSnippet`
emitted a bare iframe for every playback. A scrub embed only got its sticky scroll section if
someone hand-wrote the wrapper — the Saturn showcase's was written by the assistant, not feega.

**Now:** `doc.interactive.scrollLength` (int 1–10 viewports, default 3; old docs read the
default). `embedSnippet` picks the shape from one table, `SNIPPET_SHAPE: Record<PlayMode, …>`:
scrub → `<div data-scroll="N">` + iframe + host script (script inside the div, so
`previousElementSibling` is still the iframe); others → iframe + script. Every path uses it:
Export dialog (hosted and self-hosted), `publish_motion_embed`/`get_motion_embed` (MCP) and
`feega motion embed` via `/api/v1/motion/[nodeId]/embed`, agent `publish_embed`/`export_interactive`.

`set_interactive` takes `scroll_length`. Export → Embed shows "Scroll story" with a range input
when playback is scrub.

**Discarded:** a separate snippet per caller; a host-side default length when no wrapper exists
(the wrapper is what makes the section tall in the host page's layout).
