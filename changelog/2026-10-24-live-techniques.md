# Live techniques

Decision (user): a technique is a live reference, like a component. One source, no copies.

- Node type `technique` (`data`: `techniqueId`, `name`, `ranVersion`, `runY`). Ports come from the
  technique's declared slots (`technique-instance.ts::instancePorts`), read live from the shelf, so
  a new version changes every instance. The card shows `vN` and "Out of date" when the last run used
  an older version.
- Run (`runInstance`): reads the latest definition, fills text slots from the texts wired into the
  node (doc `content` or text `prompt`, in connection order), writes the inner graph on the
  "Technique runs" canvas (one row per instance, wiped on re-run) and queues it with
  `enqueueWorkflow`, the `run_workflow` engine. Results are inspected there, not copied back.
- Edit: "Edit technique" writes the saved graph on the canvas "Technique: <name>"; select it all,
  "Save as technique…" (name prefilled) bumps the version.
- Detach: swaps the node for a copy of the graph where it stood (today's behaviour).
- Fallback: until `20261024120000_technique_node.sql` (separate PR) is applied, placing catches the
  check violation (23514) and places a copy with a message. The node-type migration test skips
  `technique` via `NODE_TYPES_NOT_YET_ALLOWED`; remove it once applied.
- MCP: `place_technique`, `run_technique_node`, `detach_technique`, `open_technique`.
  `run_technique` keeps placing a copy.
- Not done: image/video inputs (only wired text fills slots; one port per connector type), a
  running state on the card, copying results back to the instance.
