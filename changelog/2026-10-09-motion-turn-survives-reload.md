# Motion turns land their work without the browser

**Before.** A motion turn held its edits in memory and saved them once, at the end
(`finishTurn`). Production turns that ran past Vercel's 300 s wall (`Task timed out after 300
seconds`, 08/10 15:56 and 09/10 07:21) died before that save: no revision, the reply row left
`status='streaming'` forever. A reload showed the old head (an empty video for a new node),
the chat "running" until `turnRunning`'s window — measured from `updated_at` — expired, and
Stop only stopped the local poll: the next load followed the dead turn again.

**Now.**
- `turn.ts` lands by itself before the wall: a timer at 300 s − 25 s saves the session doc,
  closes the reply `done` and aborts the model (`TurnTiming`). The save retries on conflict up
  to 4 times on the latest head (agent work wins, as before). An errored turn saves its edits.
- Each announced edit writes the working doc to `canvas-assets`
  `${org}/${project}/motion-drafts/${node}.json` (`working-doc.ts`); one write in flight,
  latest wins; dropped after the revision lands. No migration: a storage object, not a row,
  so the user's autosave (`motion_revisions`, optimistic version) never conflicts with it.
- `GET /motion/[node]/agent` returns `parts: [data-motion-doc]` while the turn runs;
  `ChatSession` replays them via `onData` on load and each poll, so the editor's `draft`
  shows the agent's progress after a reload. Turn end lands via the same `onTurnEnd` →
  `pullAgentEdit` path.
- `turnRunning` measures from `created_at` (a turn cannot outlive the function) and closes a
  cut `streaming` row as `failed` when it reads one: this also reaps the rows already stuck.
- Stop: `DELETE /motion/[node]/agent` (`stopTurn`) closes the streaming row `failed`; the turn
  polls `reply.stopped()` and lands early; live writes are guarded on `status='streaming'`, so
  a stopped answer stays stopped. The client calls it and leaves the running state at once.

**Not done.** The sidebar project agent has no `DELETE`; its Stop still only stops the client.
