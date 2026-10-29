# 0024 — One history timeline over the existing logs

## Status

Accepted, 2026-10-29.

## Context

Change history lives in four stores (`canvas_events`, `canvas_versions`, `motion_revisions`,
frame branches) shown by four UIs (AI-changes popover, Versions…, Version history…, Branches…).
Refused optimistic-concurrency writes are not stored at all.

## Decision

- Keep the four stores; add a server read that merges them into one timeline by author lane and
  session. No new catch-all event table.
- Add `session_id` to `canvas_events` and `motion_revisions`, and a `canvas_conflicts` table
  written on every refused versioned write.
- Generalise `reject_change`'s field-level rule to every author: safe when nothing later touches
  the element, otherwise per-field choice.
- One left-rail History panel replaces the four UIs; `/api/v1`, CLI and MCP get the same verbs.

## Consequences

- Moves stay out of history.
- Preview at a point reconstructs from the nearest snapshot plus events.
- `agent_changes`, `reject_change` and the canvas-version ops leave MCP/CLI in the slice that
  replaces them.

## Rejected

- One unified table written by triggers: a trigger cannot tell a user from an agent.
- Logging moves: most rows, least value.
