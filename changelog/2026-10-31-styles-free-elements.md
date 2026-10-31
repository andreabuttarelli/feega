# Free elements take styles and variables over MCP

**Why.** The canvas `styles` and `variables` ops listed only `motion` nodes, so a free text on the
canvas (an `element` node, which holds a doc exactly like a frame) could not be styled, bound or
updated by an agent. In the app the path was already the same for both: the difference lived in
one filter.

**What.** Both ops read every doc-holding node (`docNodeIds`, on `holdsDoc`): frame or free
element, one path.
