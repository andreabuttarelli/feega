---
title: Reject an agent change
description: Revert one agent change and keep the edits you made after it.
sidebar:
  order: 10
---

An agent (the chat in the sidebar, or one over MCP) writes on the canvas like a person. Reject undoes **one** of its changes and leaves everything else as it is now.

## In the canvas

1. Click the **bot** button at the bottom right. It lists agent changes, newest first, one row per gesture.
2. Click **Reject** on a row.

What goes back:

- **Edited node**: only the fields the agent changed (and its position, if it moved the node). Fields you changed later on the same node stay.
- **Same field edited since**: nothing is written. For each field you pick **Keep mine** or **Take reject**, then **Apply**.
- **Created node**: deleted. If someone else connected or edited it since, you are asked first.
- **Deleted node or line**: restored. **New line**: removed.

The reject is recorded as yours and is one step: `Cmd+Z` brings the agent change back.

## From the CLI and MCP

```bash
feega canvas $PROJECT agent_changes --input '{"canvasId":"<canvas>"}'
feega canvas $PROJECT reject_change --input '{"canvasId":"<canvas>","eventIds":[42]}'
```

Over MCP, use `edit` with op `agent_changes` or `reject_change`; `view` op `activity` also returns each event `id`.

`reject_change` answers:

| `outcome` | Meaning |
|---|---|
| `rejected` | written; `reverted` lists the paths |
| `conflict` | per field: `path`, `mine`, `agent`, `original`; resend with `choices: [{eventId, path, keep: "mine" \| "reject"}]` |
| `confirm` | someone else touched the created node; resend with `confirm: true` |
| `stale` | the node changed during the reject; retry |
| `not_found` | unknown event id |
