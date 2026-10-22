# Components, instances and overrides

Reuse inside frames existed only as groups/precomps: copies drifted, no main to edit once.

- A **main component** is a composition with `component: { name }` (optional field on
  `compSchema`). An **instance** is a `Precomp` clip pointing at it, with
  `props.overrides: { [innerClipId]: props }`.
- `precompTracks` (`precomp.ts`), the single expansion step that both the GPU display list and the
  HTML export read through `flattenComps`, merges the overrides — the renderers cannot disagree.
- Ops in `src/lib/motion/main-component.ts`: create (⌥⌘K, precompose + mark), override, reset,
  detach (bakes overrides into a plain copy). Registered in the frame bar registry
  (`frame-inspector.ts`), so keys, right-click menu and Properties bar share them.
- UI: Layers shows instances with a purple diamond; Properties shows an instance section with the
  main's texts as override fields, Reset and Detach. MCP: one `component` tool (create, override, reset, detach; it fits the canvas chat 30k prompt budget).

Not done: overrides on non-text props from the panel (MCP takes any prop), editing an element
inside an instance directly on canvas writing an override (it edits through the panel).
