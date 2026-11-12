# Perf: compare overlay chrome structurally, not through JSON

`world-overlay.ts` keeps wire and node-chrome path items across frames when their inputs are
equal. The check serialised both sides with `JSON.stringify` whenever the objects were not
identical, and on every zoom frame the chrome tiles are rebuilt as fresh objects: profiles on dev
(with #1975) put this at ~500 ms of a 4 s zoom on both landings and the heavy canvas, the top
JS cost of the gesture. A recursive field compare gives the same answer without allocating.
Differences only make it rebuild more (an `undefined` field, `NaN`), never reuse stale items.
