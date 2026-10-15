# "Build the teaser now" no longer stalls on an empty timeline

On a blank video, "build the teaser now" ran the director turn: a researcher round (Sonnet, read/research/import tools only) then the director writing script and storyboard. The researcher got the raw request with no brief and replied "I can't build this video yet, I only have tools to read, research and import assets"; that text led the turn's reply, the canvas chat relayed it, and nobody asked for the build. Live repro on the test account: run 1 saved "the research and the script" and said it could not build.

- The research round now gets `RESEARCH_BRIEF`: research only, no answer to the user.
- `TurnOutcome.scripted` (director turn that wrote a revision) → `askStatus.script_ready` → `relayed` tells the canvas chat to call `ask_motion_agent` again to build.
- The working doc (`<org>/<project>/motion-drafts/<node>.json` in `canvas-assets`) was upserted with the user JWT; the bucket has no UPDATE policy, so every keep after the first failed with RLS and a reconnecting editor read the first edit. It is now removed then inserted, and a failure logs as an error. `motion-drafts` is a path, not a bucket.

Discarded: a migration adding an UPDATE policy on `canvas-assets` (not needed for this fix; offered to the coordinator separately). Chaining the shot builder into the director turn: doubles one turn's cost and time.
