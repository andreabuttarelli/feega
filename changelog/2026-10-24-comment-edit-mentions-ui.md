# Comment edit, delete, @mentions and the unread dot (UI)

Client side of #1223.

- Panel: Edit / Delete on your own comments and replies (`editComment` / `deleteComment` page
  actions), "(edited)" tag, author names from `teammates`.
- Mentions: typing `@` suggests teammates; the ids sent are derived from the text at send time
  (`mentionedIds`, longest name first, so `@Ada Lovelace` does not also tag `Ada`). No hidden
  state to drift from what the body says. The server still drops ids that are not org members.
- Unread dot on the canvas switcher and the Comments item: a mention of me, by someone else,
  newer than the last seen mark. The mark is the newest server timestamp among loaded comments,
  written to `localStorage` (`feega:comments-seen:<canvasId>`) while the panel is open, not the
  client clock, so skew cannot hide or invent a dot. Comments now load on page mount for it.
- E2E (`canvas-comment-edit-mentions.spec.ts`) runs on the test account, which has one member:
  the teammate and the incoming mention are injected into the `canvasComments` response. Edit,
  delete and the outgoing `mention` field are real.
