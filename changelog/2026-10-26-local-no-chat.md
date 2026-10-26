# Local mode: cloud-only controls are off

Chat, sharing, credits, comments, saved versions, new canvas, canvas import,
the brand badge/org line and Drive/Dropbox import only work with an account
and the network. In local mode they opened panels or links that could not work.

All of them are rows of one enum, `LocalOff` in `local-user.ts` (`isOff` reads
it on the client). No second table: each surface asks the enum once.

- `RightBarHost` takes the tabs that are off: `tabs` omits them, `select`
  ignores them, the first tab left starts. A stored `chatTab`, a chat handoff
  link and the top bar toggle never land on Chat; the chat pane is not mounted.
- Top bar: credits link, Share, Versions, Comments, New canvas, Import .feega,
  brand badge. Account menu: org line. Add bar: Drive/Dropbox, comment tool
  (and its `C` shortcut, via `onCommenting`).
- Already table-driven before this change, untouched: rail entries and account
  menu items (`local: true`), logout.

Not touched: AI Generate tiles in the add bar and the node context menu
(local editing actions only). Generate nodes still exist as containers; the
run answers with the cloud message.
