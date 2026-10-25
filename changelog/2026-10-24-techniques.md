# Techniques

F2 (flora-vs-feega). A flow that worked had to be rebuilt by hand or copied node by node.

- Table `techniques` (org-level: `name`, `plan`, `inputs`, `outputs`, versioned, soft delete, RLS
  `auth_org_ids()`). Needs migration `20261024110000_techniques.sql`: NOT applied. Until then the
  repo answers `unavailable` and the list is empty.
- "Save as technique…" on a selection of 2+ connected nodes (`canvas/technique.ts::packageTechnique`):
  keeps the nodes and the edges inside the selection (the `DuplicatePlan` of copy and paste, run
  state stripped, moved to the origin) and declares the slots: inputs are the nodes nothing feeds,
  outputs the ones that feed nothing. Connected and acyclic, checked with `planWorkflow`.
- The Templates gallery lists "Your techniques"; picking one places the flow at the view centre
  (`insert_technique` page action -> `runTechnique` with `TechniqueRun.Place` -> `writePlan`).
- Ops for agents: `list_techniques`, `save_technique`, `run_technique` (places, sets the prompt of
  each input slot, then `enqueueWorkflow` over the generation nodes: the same engine as
  `run_workflow`; `run: false` only places), `delete_technique`. Tool pin snapshot extended on purpose.
- Decision: an instance is a materialised copy, not a live reference to the definition. A
  reference would need a new node type (`nodes_type_check`), ports declared per instance and a
  hidden inner graph; the copy reuses the whole existing engine. Editing = save again under the same name
  (version bumps); existing copies are not updated.
- Not done: the stale-only re-run of an instance (the fresh copy has nothing stale), sharing
  outside the org, an input/output slot editor, UI to delete a technique (op only).
