# Cmd-resize ignores constraints

`fitToNode` takes a `ResizeMode`; `Ignored` pins every layer left/top for the resize and restores
its own constraints after, so pixel size and place stay. The canvas page reads Cmd/Ctrl from the
pointer events (capture) and passes the mode to the live preview, the open-doc edit and the
`frameSize` action (`mode` field, default constrained). Not wired for MCP `set_canvas` yet.
Not checked in a browser: unit and route tests only.
