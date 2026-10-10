# Motion turn: one clean final message, every used asset listed

**Before.** The stored reply joined the text of every step (`finishedTurn`): the v2 trailer's last
message stacked ~6 drafts, then the raw gate list after the agent's question, so the question was
buried and the test driver did not answer it. `doc.assets` listed only the music while 6 images
were used: only `add_clip` registered assets, so set_props, templates and nested comps did not.
`motionSource` (embed, export source) filtered by `doc.assets`, dropping those images.

**Now.** `finalReply` (frames.ts) keeps the last summary only and puts the still-open note before
its closing question. `referencedAssets` (doc-assets.ts) derives the list from every asset id the
doc references (tracks, comps, fonts, fields); the turn syncs `doc.assets` with it before saving and
`motionSource` uses it.

The live stream still shows each step as it happens; only the stored message changed.
