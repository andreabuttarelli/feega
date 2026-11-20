# Icons from a library are picked as one element

Clicking `<ArrowRight size={32} />` from lucide selected the parent: the `svg` the library renders has no source of its own, and in Svelte its paths carried the library's file.

`injectSource` now also tags a component imported from an icon package (`ICON_PACKAGES` in `icon-imports.ts`: lucide, react-icons, heroicons, tabler, phosphor) with `data-feega-src` at the usage, original line and column, plus `data-feega-icon` with the component name. The libraries spread props onto the outer `svg`, so only it carries the tag. `stampSources` skips everything inside an icon, so a click on a `path` resolves to the `svg`.

The selection and the Layers row are named after the component (`ArrowRight`); the picker reads the current icon from the usage and the swap rewrites it, as before. Path-style libraries (`@lucide/svelte`) also accept a named import from the package root.

Discarded: reading the usage from the React fiber at runtime, because stack frames are transformed lines, not the file's. Attaching without the plugin does not tag icons.

react-icons is tagged but cannot be swapped: its per-family packages are not in `icon-library.ts`.
