# Phone motion editor: the Agent sheet hides the play bar

**Before.** On phone the transport bar (play, clock) sat between the Agent sheet and the tabs at
every detent, eating 64px the composer and the keyboard needed.

**Now.** `transportOf(viewport, agentDetent)` in `src/lib/motion/editor-layout.ts` decides it in
one table: phone + Agent at half or full → hidden; peek, closed, Properties or any larger
viewport → shown. `sheetFloor(transport)` drops the sheet floor from 120px to 56px, so the sheet
keeps its top edge and grows down into the freed row; height and bottom animate together over
160ms (none with reduced motion, none while dragging the grabber). The agent dropping the sheet
to peek after an edit brings the bar back on its own.

**Discarded.** Hiding the bar without moving the floor left a 64px hole above the tabs.
