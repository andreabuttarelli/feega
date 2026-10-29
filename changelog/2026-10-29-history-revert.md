# History 3: revert a change, retire the AI-changes popover (#1549)

Spec `docs/specs/history-panel.md`, ADR 0024.

- `revertChange` (`src/lib/server/canvas/revert.ts`) resolves an entry id or a
  session key to `canvas_events` ids through one registry, `RESOLVERS` (one
  row per source or session prefix), then runs the existing `rejectChange`
  rule unchanged: it was already author-agnostic; only the listing
  (`agentChanges`) was agent-only. Versions/revisions/branches answer
  `not_revertable` (they have Restore).
- A choice without `eventId` applies to every event of the change, so a CLI
  `--keep data.prompt=reject` answers a whole session.
- Session keys for people (`idle:<laneKey>:<entryId>`) no longer depend on
  the filter: they used the lane index.
- Wired as rows in the #1565 registries: `HistoryAction.Revert`
  (`SOURCE_ACTIONS` event row), REST `[entryId]/[action]` (`revert_change`),
  panel route `WRITES`. MCP `revert_change` replaces `agent_changes` and
  `reject_change`; their page actions, parity rows, `AgentChangesPanel.svelte`
  and the reject docs page are removed.
- MCP canvas ops now write with agent key `mcp` instead of `sidebar`: they
  showed on the Chat lane.
- Not done: the small AI toast linking to History. No such toast exists
  (spec, "What is missing" 8); one needs agent-change detection on the
  realtime path, left for its own slice.
- Discarded: the spec's `mine|theirs`; kept `mine|reject`, the values
  `reject_change` already spoke.
