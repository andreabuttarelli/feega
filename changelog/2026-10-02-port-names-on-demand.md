# Port names on demand

Every typed port carried its name chip ("Text", "First frame", "Video")
at all times; on a busy canvas the chips crowded the nodes.

Now the port stays as a coloured square and its name shows on: port
hover, node hover (only where `(hover: hover)`), node selected, focus.
During a connection drag `portLook` (connectors.ts) marks each port
`lit` (accepts the wire: name shown, outlined) or `off` (dimmed, no
name). One CSS rule set in `CanvasTile.svelte`, no per-node state.
Fade 120ms, none under reduced motion. `aria-label`/`title` unchanged.

Discarded: a JS hover state per node — CSS `:hover` already knows.
