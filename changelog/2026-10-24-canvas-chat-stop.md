# Stop works on the canvas chat

Plan `one-chat-agent.md` §7, PR 3 (first slice). The chat panel's Stop sent `DELETE` to
`/api/v1/projects/:id/agent`, which had no handler (405): the turn ran on and kept spending.

- Route `DELETE` → `stopTurn` on the project thread (same as the motion route).
- `landingWatch` moved from `motion/turn.ts` to `agents/turn-core.ts`; the project turn uses
  it: the stop poll lands the turn (reply saved, stream aborted), and the wall timer lands it at
  `AGENT_SELF_SAVE_MS` like the motion turn.
- Not done from PR 3: `followStream`, `turnBilling`, `logTurn`, `startAgentTurn`.
