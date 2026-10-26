# Canvas chat: arrows, style library, frame share link

Plan `one-chat-agent.md` §8 step 5. These shipped in the UI/MCP without a chat tool because
the chat had a 30k-char surface cap; with tool loading the cap is on the core only.

- `draw_element` takes `{ tool: line|arrow, from, to, stroke?, theme? }`: `drawnOf` turns it
  into a stroked open pen path (`lineOutline`, `LINE_PAINT`), the same geometry the canvas line
  and arrow tools draw. MCP `edit` gets it too (same schema).
- Canvas ops `styles` and `variables` lose `Audience.Mcp`: the chat reaches them via
  `canvas_tool`.
- `share_motion_frame` is a motion delegation row (`shareMotionFrame`), like MCP's.
- Core cap raised to 30k chars.
