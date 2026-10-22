# Command palette runs actions by id

The palette is built from the action registry (`Command`, `ACTIONS`) instead of
the shortcut table, so actions with no key (select same fill / stroke / font /
effect) and ones whose key is shadowed in Design now appear. Running an entry
calls the frame runner (`runFrameAction`) or the canvas runner (`KEY_RUN`, via
`CANVAS_COMMAND_OF`) with the id. The old way, dispatching a synthetic key, is
gone: it could not reach unbound actions and depended on the key being free.
Entries with no runner are not listed (timeline-only commands).
