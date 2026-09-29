# Source settings inside the node, and ports for every node type

## Before

- Products / Social feed settings opened as a global overlay (`NodeInspector.svelte`) on the right
  of the canvas, mounted by the canvas page.
- Products, feed and Select drew a generic, invisible handle (opacity 0 until hover), so users
  could not see how to connect them. Ports were decided by scattered `if`s in the page.
- A video post picked by Select passed the `.mp4` URL as an image reference.

## Now

- `SourceSettingsFrame.svelte` wraps the preview; when the node is selected it renders
  `InspectorFields.svelte` (the old inspector body, same field table and save path) as a right
  column. The scroll area carries `nowheel nodrag nopan`.
- `settings-column.ts::withSettingsColumn` grows the Svelte Flow node by `SETTINGS_COLUMN.w`
  while selected (width/height props, which override the style); Svelte Flow re-measures, so
  handles and edges move. `CanvasTile` subtracts the growth on resize end and from the resizer
  minimum, so the saved size stays the preview size. Width animates (160ms, off under
  reduced motion).
- Mobile (`MOBILE_QUERY`): the column goes below the preview and the node grows in height.
  Chosen over a bottom sheet: one code path, no second overlay to maintain, the settings stay
  attached to the node they edit.
- The overlay and its mount are deleted: no other node type used it.
- `node-ports.ts::NODE_PORTS`: one row per node type for inputs and output. Products/feed output
  `images`; Select takes `text`/`images` and outputs its item's kind; non-generated nodes draw no
  input. `CanvasTile` draws no generic handle for node types anymore.
- `graph.ts`: Select accepts only `SELECTABLE_SOURCE_TYPES` as source.
- `select-sources.ts`: a video slide yields its thumbnail.

## Discarded

- A new `list` connector type: every generative port would have needed to accept it; `images`
  matches what the List node already outputs.
