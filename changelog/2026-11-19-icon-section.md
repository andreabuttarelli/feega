# Icon section in the inspector

An `svg` is now role `icon`, not `media`. Its Properties show Icon (colour, stroke width), Size with W/H linked, and Opacity.

Colour is currentColor-aware: when the computed fill or stroke equals `color`, the row writes `color`; otherwise it writes `[fill:...]` or `[stroke:...]` on the svg. `fill`, `stroke` and `stroke-width` are now read by the page bridge.

Replace icon searches the project's installed library (lucide, heroicons, tabler, phosphor, iconify, detected from package.json) and iconmcp.com (`search_icons`, `get_icon` over JSON-RPC, fetched from the host), and takes an uploaded `.svg`. A library hit rewrites the component and its import (`icon-swap.ts`); the others write markup (`svg-markup.ts`).

Edit SVG writes in place for an inline svg, into the string constant for `{@html}` (resolved with `data-source.ts`), or into an imported `.svg?raw` file. A source that cannot be resolved is refused with the reason. Each write is one undoable step in Changes.

Discarded: swapping an inline svg for a library component (the markup is written instead); iconify search (the name is swapped, there is no search).
