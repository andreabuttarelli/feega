# Per-video budget, one review, no repeated lines, crews held to range

ai_calls of v7 linear ($6.33): director/shots/fixer within shares, then
two more builder turns ($1.22+$0.40, $1.20+$0.40) each opened by the eval
driver's reply or a "keep the cut" answer, each re-running the critic.

- `VIDEO_CAP_USD` ($2) in limits.ts. Every motion call is logged with
  `ai_calls.node_id` (`withVideoContext`/`billingScope(org, node)`);
  a turn reads the video's spend, stops at min(role share, video left),
  and with nothing left answers without a model: cost so far + the
  raise phrase. Each "Raise the video budget and continue." in the
  thread adds another $2.
- The critic reviews a video once (`reviewedBefore`).
- "Keep it as is" is answered without a model call.
- `scriptProblems` refuses a line said twice; copywriter told so.
- Shot crews: `add_shot` outside the crew's range is refused.
