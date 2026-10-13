# Crafting agent: compositions from a reference, in rounds

Before: the motion chat wrote a custom component in one shot and moved on. The premium library
templates (iridescent-blobs, flow-lines, particle-ribbon…) were made offline by dedicated Claude
Code agents that studied exemplars, rendered frames, compared them with the reference and fixed
them over 3–5 rounds. This brings that loop into the product.

What exists now:

- `craft_composition` (`src/lib/server/motion/craft.ts`, adapter `craft-agent.ts`): the chat
  agent hands a brief plus reference asset ids to a sub-agent on Opus. Its first message carries
  the reference pictures; while it runs `session.references` points at them, so every
  `view_frames` it calls returns the frames next to the references. Restored after.
- The crafting agent gets a fixed tool list (`CRAFT_TOOLS`) and a system prompt with the loop
  (study → write → look → measure → fix), the house motion rules and the component contract.
  Exemplars come on demand through `read_template_source`, not in the prompt.
- `check_motion` (`motion-check.ts`): 24 consecutive frames, jolts (`motionJolts`, the logic
  of `scripts/motion-smoothness.ts`) and frozen spans (`frozenSpans`). Loop seam stays in
  `view_frames`.
- `save_template` takes `key_fields` (≤5), mapped through a comp's local keys.
- Chat: the chip "craft composition" spins while it works, the editor preview follows its edits
  (each child step announces the doc), and at the end shows one contact sheet per round
  (`VIEWING_TOOLS`).
- The editor uploads frames in batches of 6 (`frameUploads`): `check_motion` asks for 24 and
  the endpoint accepts 6 per request.
- `runChild` extracted from `spawnAgents`, shared by spawn and craft.

Fixed on the way: `spawn_agent` (and now `craft_composition`) were wrapped by `oneAtATime`, so
a child calling any motion tool queued behind its own parent call and deadlocked. Delegating
tools now sit outside the queue.

Eval: case `craft` in `scripts/eval/motion-quality` attaches `references/iridescent-blobs.jpg`
and adds `craftRounds` (fact) and `referenceMatch` (judge) to the report.

Discarded: a new studio role for crafting (the role picks one model for the whole turn; the
craft must be a nested, budgeted run inside a builder turn); putting library sources in the
system prompt (tens of KB per step).

Known, not fixed here: a 30 fps template inserted into a 60 fps doc keeps its inner length in
frames and goes black halfway.

Second pass, after the first eval run (reference match 6/10, $2.35, 3 rounds):

- `compare_reference`: after each look the crafting agent lists concrete differences and scores
  the match 1-10; it keeps going until 8 or the budget runs out. Generative guidance added
  (supersampling/AA, raymarch detail, clustered scatter, text scrims).
- Each round (sheet, score, differences, check_motion numbers) is in the tool output and streams
  as preliminary results; the chat keeps the chip running while rounds arrive.
- The budget is clamped to what the video has left instead of being refused.
- Quality gate: a table per kind of piece (`Piece` in `direction.ts`). An abstract generative
  piece (no script, no story marks) is not asked for script, music, story beats, a peak or
  the type scale of text it cannot measure. This applies to the whole motion agent.
- `set_timing` that shortens a clip refits the video as timed, without an added hold.

Second run: reference match 7/10, 7 rounds (self-score 4 → 7), $2.80 total, 0 tool errors.
