# Frame mode switch in the inspector, timeline only in Motion

The Design / Motion switch lived only inside the floating timeline, and the timeline showed for
every frame regardless of mode. Since #1452 frames start in Design, so the timeline was open on a
mode that does not use it.

The switch is now the first control of the frame inspector (frame and element views), hidden for
stills. The timeline mounts only while the frame is in Motion (`timelineShown`). `MODE_LABEL` moved
to `edit-mode.ts`, shared by both buttons. The `E` shortcut is unchanged.
