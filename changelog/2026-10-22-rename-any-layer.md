# Rename any element in Layers

Only tracks could be renamed (`CLIP_EDIT` refused). Clips now carry an optional
`name` (max 60) that Layers shows instead of the component's default label; an
empty name removes it. Double-click or Enter on a picked row opens the field,
Escape cancels. Agent parity: new `rename_clip` tool, `name` in
`get_motion_doc`. Not done: rename from the canvas itself and canvas nodes
(no node-rename path exists yet).
