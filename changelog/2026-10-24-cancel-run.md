# Cancel one running generation

F4 FL-19. `cancelNodeRun` (generate.ts): claims each running non-loop run of the node, closes it `failed`/`cancelled`, releases the job hold, and sets the node `running:false`. Billing is written on completion (`ai_calls`), so a run cancelled before it finishes is never charged; an in-flight provider call is not aborted.

- Page action `cancel_run`, op `cancel_run {nodeId}` (MCP/edit), tool pins updated on purpose.
- Stop button in the selection toolbar when the selected node is running.
