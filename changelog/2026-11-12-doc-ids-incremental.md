# Canvas: asset-id scan reads only what an edit changed

Every element edit inside a frame ran `adoptAssets` twice (on record and on save), and each call
`JSON.stringify`'d the whole doc and ran a UUID regex over the text: ~28 ms of main thread per edit
on a landings frame (CPU profile of four nudges: 113 ms in that regex), before the live rebuild
could start.

Asset ids are now collected per sub-object and memoized in a `WeakMap`; an edit replaces only the
objects on its path, so the rescan reads those. The doc text is still built, lazily, for the
non-UUID `includes` lookup.

Edit latency on landings (perf:budget, p50): nudge 243→228 ms, opacity 329→212, hide 245→197,
resize 176→149. The pre-build stage is still 75–125 ms and the whole-frame worker build 80–160 ms:
both remain over the 16.7 ms gate.
