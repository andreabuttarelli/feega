# Studio roles: director, builder, fixer, critic

`studio-roster.ts` is the one table: role → ai_calls label, share of
`AGENT_TURN_CAP_USD`, tool scope. `turnRole` picks the turn's role:

- **Director** — blank doc + new-video request: only research, brand,
  references, recreate_ui, script and storyboard tools (60% of cap). It
  cannot start building before the brief gate.
- **Builder** — everything else, all tools (88%); its critic 12%.
- **Fixer** — a turn answering the cut review: all tools, 50% of cap,
  no second review. Bounds the apply turn that pushed the linear eval
  to $2.47.

Labels per role (`motion-director`, `motion-fixer`, `-code`/`-vision`
suffixes) make cost per role a group-by on ai_calls.operation.

Not built: Researcher and Sound as separate sub-calls (Researcher's
tools live in the Director scope), parallel shot builders.
