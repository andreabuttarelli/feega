# Live edits write into the working folder

Live edits went to `feega/live`, a branch checked out in a second folder that ran its own dev
server. For a vibe coder working with Claude Code or Cursor in the same project it was the wrong
default: their agent's changes never reached the live frames, and canvas edits never reached the
files they had open.

Now the default target is the folder itself (`live-target.ts`, `LiveTarget.Folder`): the edit
is written into the file, the user's own dev server is reused, and undo is a snapshot of the
file before and after. Undo refuses when the file no longer matches what Feega wrote, so it
never wipes what an agent wrote afterwards. Changes lists only files the canvas touched, diffed
from their content before the first edit. The branch mode stays, behind
`FEEGA_LIVE_TARGET=branch`; both modes are rows of one table (`TARGETS`).

Snapshots live in memory: restarting Feega forgets them, so an edit from a previous session is
undone with git, not Cmd+Z.
