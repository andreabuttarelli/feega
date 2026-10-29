# Frame code inline in coder mode

Coder mode showed "Select one layer" when the frame itself was selected. It now shows the frame's
exported code in the right bar: target picker, copy, and a button that opens the existing
"Export code…" dialog (kept in the overflow menu). Same `exportCode` as the dialog; the entry-file
choice moved to `entryFile` so both share it. Scenes are not resolved inline (the dialog resolves
them), so a frame built from scene references shows them unexpanded until opened in full.
