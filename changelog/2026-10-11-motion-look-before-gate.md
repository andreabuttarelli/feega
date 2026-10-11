# Motion agent: looking is split from checking

**Why.** A real eval turn called `view_frames` 15 times. Every result carried 20–30 lines of
gate warnings before the pictures, and the agent reacted to the text, almost never to the frames:
it wrote that a frame "reads clearly" where the gate had measured 50% plain white.

**Before.** `view_frames` returned `quality` and `blocking` (every gate line, unranked, repeated
per frame) as the first text block, then the images. Nothing required the model to say what it saw.

**What.**

- `look.ts`: `describe_frames` takes one line per viewed frame (`visible`, `wrong`). `lookFirst`
  refuses every tool except reads and `view_frames` while the last look is undescribed; a new
  look replaces the pending one. `gateBlock` dedupes the gate per check (`3×`), ranks blocking
  first, keeps the top 5.
- `frames.ts`: the model output is JSON without the gate, the frames, the references, and the
  gate block last. `fixPrompt` asks for the description first.
- `viewer.ts` + `StudioRole.Viewer` (`motion-viewer`, Sonnet 5.5, no tools, no gate text): the
  critic now gets the viewer's per-frame lines next to the contact sheet. Viewer billed in its
  own scope so the critic's cost is not counted twice. Critic share 0.12 → 0.08 + viewer 0.04.

**Kept.** `quality`/`blocking` stay in the tool's raw output: the gate state, tests and the
delivery loop read them; only the model's view changes.

**Discarded.** Refusing a second `view_frames` before describing: the self-check round forces
`view_frames` at step 0, and a refusal there wasted the round.
