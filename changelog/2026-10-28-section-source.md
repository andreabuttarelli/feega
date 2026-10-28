# Sections feed generative nodes

**Before.** A section only grouped nodes. To use several of them as inputs, each needed its own edge.

**Now.** A section has an output port (connector `text`, round like the others). An edge from a section to a
generative node makes `expandSectionEdges` (`src/lib/canvas/section-source.ts`) replace it with one
synthetic edge per member (`groupId` = section), inside `upstreamInputsFor`, the one function every run
path (UI, toolbar, keyboard, MCP `run_node_generation`, loops, node hints) reads. Explicit edges win and
dedupe; the consumer is excluded from its own section; an edge that would close a loop is skipped.
Per-item exclusion is `data.sectionExcluded` on the consumer (a layout key, validated in `node-layout.ts`).
Image cap and rejection reasons reuse `resolveUpstreamInputs`. `GenNode.svelte` shows the expandable line.

**Discarded.** A per-node "section context" flag with automatic injection: it hid inputs that no edge showed.
