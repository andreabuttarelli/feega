# Live components with still(t) no longer warn about a stand-in

A live component that returns `{ still(t) }` is drawn from `t` on every video frame, so the video
matches. The quality gate (`liveScenes` in `direction.ts`) and the export dialog still said "a
still stands in" for it.

Decision: faithfulness is read from the component's own source, in one place —
`stillStandIns(doc)` in `custom/determinism.ts` (live components whose JS lacks
`return { … still … }`). A declared flag in the component meta was discarded: it can claim a
still the code doesn't return. The editor's "live" badge keeps `liveComponents`: the component
is still live in previews and embeds.
