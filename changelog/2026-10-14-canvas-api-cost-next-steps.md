# estimate_text_cost and suggestNextStep have an /api/v1 op

Step 1 of moving the canvas page actions to `/api/v1` (ADR 0009, option d). Both were ui-only
in the parity table and had their logic inline in the page.

The bodies moved verbatim to `nodeTextCost` and `nextStepsFor` (`server/canvas/node-hints.ts`).
The form actions and the ops `estimate_text_cost` and `suggest_next_steps` call them. Both stay
ungated reads, as the actions were: Jev only re-orders when `TYPESAFE_API_KEY` is set. Client
unchanged.
