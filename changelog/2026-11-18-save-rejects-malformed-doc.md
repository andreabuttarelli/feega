# A malformed frame doc is refused, not thrown on

`saveMotionDoc` ran `unsettled` (the host-settle check of a free element) on the raw input before
`appendRevision` validated it with `parseMotionDoc`. A doc that was `null`, had a track without
`clips`, a `null` clip or a clip without `props`/`transform` threw a `TypeError` instead of coming
back `Invalid`. The raw-`unknown` callers are the `.feega` import (`heads[*].doc`) and canvas-version
restore (`plan.docs[*].doc`): one odd frame crashed the whole request.

`saveMotionDoc` now parses first and runs the settle check only on the parsed doc; an invalid doc
skips it and `appendRevision` returns `Invalid` as before. Valid docs settle on the parsed
(upgraded) doc instead of the raw one, which also stops an old-shape doc from being settled before
its upgrade. Rejected: null-checks inside `footingOf`/`rootsOf`, which would leave every other
reader of the raw doc exposed. Cost: one extra `parseMotionDoc` per save.
