# Chat: the selection shows as chips and travels with the message

The selection was already sent to the agent, but only as ids, invisibly: nobody could tell what
"this" would mean, and a layer picked inside a frame travelled as a bare id with no name.

Now `chat-selection.ts` turns the selection into chips (`id`, `kind` node or layer, `type`, `name`,
`frameId` for layers). `CanvasChatPanel` publishes them to `ChatSelection`; the composer shows them
and lets the user dismiss one, and `context()` sends only the chips still shown, so the chip is the
single thing that is sent: a dismissed layer chip is also removed from `frame.selection`.

The route reads the chips with `readChips` (shape check, at most 20, names cut), `saveTurn` writes
them to the new `chat_messages.selection` jsonb, `loadTurns` returns them, and the system prompt
names each one with its id, type and frame. The name is captured at send time and never
re-resolved: a renamed or deleted target keeps its old chip in the history.

Decisions: no `+N`-only chip replaces the list, three chips then `+N` with the hidden names in its
title; a new column rather than overloading `attachments`, whose schema is assets only. The
migration `20261111120000_chat_messages_selection.sql` is not run by deploys: apply it before this
ships. The column is written only when a message has chips, so an unmigrated database fails
only those messages, never the plain ones.
