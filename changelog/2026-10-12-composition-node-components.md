# Composition node plays any motion library component

Before: the canvas Composition node only offered its own media layouts; the component library
(built-ins and team templates) lived only in the motion editor.

- **Data.** `nodes.data.template = { id, values } | null` on `composition` (jsonb, no migration).
  `values` are the template's own field keys → raw strings, the same shape `setTemplateValues`
  takes. `compositionOf` drops a malformed pick instead of breaking the draw.
- **One mapping, one place.** `templateInputs` in `src/lib/canvas/composition-template.ts`: a
  table by field type. A media slot takes the next wired medium, a media list takes the rest in
  order (`video:` for videos, a motion's poster as an image). Typed values are never media: the
  canvas wires them. `composedTemplate` = `starterDoc` + those inputs, with sequential ids so the
  preview doc is stable across renders.
- **Same library, no copy.** The canvas page opens `ComponentLibrary`/`ComponentDetail` with an
  `AddTarget` (Video | Composition) that picks the button label and hides "Add sounds".
- **Open editor** branches once in `openCanvasComposition`: a picked node goes through
  `startFromTemplate` (now taking `canvasId`, `values`, `wired`) and redirects to the motion
  editor; `ComposeStart` carries its own `editor` path.
- **Agents.** Sidebar tools `list_components` and `set_composition_component` (validated by
  composing the template, written via `patchNodeData` with the schema check). MCP/API already
  reach it: `/api/v1/motion/templates` lists, `/api/v1/org/nodes/[id]` patches `data.template`.
- Discarded: duplicating the catalogue in a node-local picker; mapping media by field name.
- Known gap: the canvas loads all templates on page load (as the motion editor does).
