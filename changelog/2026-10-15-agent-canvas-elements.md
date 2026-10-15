# Project chat: free elements

The canvas ops `draw_element`, `group_elements`, `ungroup_element` (added with the app features)
are now in the project chat's own tool list (`CHAT_TOOL_OPS`), with descriptions that tell a
free element from a Generate text node. `move_frame_element` now says it lands on the canvas as a
free element. CLI skill docs (both mirrors) updated. Parity: every new page action maps to a
canvas op or motion tool in `ui-actions.ts` (`drawElement`, `moveFree`, `groupElements`,
`ungroupElement`, editor `Group`/`Ungroup`).
