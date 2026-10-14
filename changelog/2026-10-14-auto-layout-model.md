# Auto layout in frames: the model, the renderer and the agent

Frames placed every clip by hand. Auto layout (Figma-style flexbox) lands as two optional clip
fields, `autoLayout` on a container and `layoutItem` on a child; membership is the existing
`parent`. ADR 0008 has the reasons.

- `src/lib/motion/layout/auto-layout.ts`: the pure engine, px in, boxes out.
- `src/lib/motion/layout/resolve.ts`: `withAutoLayout(doc)` writes the boxes into the children's
  props (and a hugging container's own); `composeHtml` runs it right after hidden clips are
  dropped, so video, still and editor preview agree.
- `text-extent.ts`: text that hugs is sized by a metrics estimate, not by measuring in the
  browser — a render must not depend on which browser last opened the editor.
- `ops.ts`: wrap a selection (new transparent rectangle on a track below, children parented in
  reading order, direction and gap guessed from their positions), set the layout, size a child,
  reorder, leave (keeps the laid-out box).
- Agent and MCP: `add_auto_layout`, `set_auto_layout`, `set_layout_item`, `reorder_auto_layout`,
  `leave_auto_layout`; `get_doc` shows both fields. Patch schemas carry no defaults, so a call that
  names only `gap` never resets `direction`.

No doc migration: a doc without the fields is unchanged. Box props are not keyframeable, so a
container re-flowing over time is out of scope; containers animate through their transform.
