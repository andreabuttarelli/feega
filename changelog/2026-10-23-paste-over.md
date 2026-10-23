# Paste over the selection

Shift+Cmd+V (Figma's "paste over") puts the copied elements centred on the selection and keeps
the selection, unlike paste to replace (Shift+Cmd+R), which removes it. `pasteOverElements` in
`move-element.ts` moves the copy as a block so relative offsets between copied elements stay;
keyframes and animation come with the copy. Wired as `Command.PasteOver` through the frame key
table, the action registry and the parity table (agents use `add_clip`).
