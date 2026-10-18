# Paste a free canvas element into the selected frame

⌘V with exactly one frame selected and free elements on the tile clipboard calls
the new `copyFree` action: `moveFree` with `FreeSource.Keep`, so the free element
stays and undo only reverts the frame revision. Otherwise ⌘V pastes tiles as before.
Agent parity: `copy_frame_element` on the free element's node and clip.
