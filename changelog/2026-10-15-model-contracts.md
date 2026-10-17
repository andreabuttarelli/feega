# Every offered task model sends a request its provider accepts

Before: `wireInputs` forwarded node params as they were. A stale aspect, resolution or duration
from a previous model reached the provider; Wiro required fields (`size`, `resolution`, `ratio`,
`quality`…) were never sent unless the node had a control for them; models whose schema no node
can satisfy (required field without default, uncensored + required image) were offered; uncensored
Wiro models advertised image inputs the uncensored guard then refused; the canvas did not snap the
aspect ratio on a model change.

Now:
- `wireInputs` takes the wire spec, sends `wire_spec.fixed` (required defaults), keeps a control
  only if it is in the model's enum (duration snaps to nearest), caps `imageList` at `maxRefs`.
- Wiro sync writes `fixed`, `requiresImage`, `unrunnable`; `offerable-models` hides unrunnable
  rows; `startTaskRun` refuses unrunnable and image-less `requiresImage` runs before submit.
- `taskChoice`: uncensored ⇒ `maxRefs 0`, no `image` modality.
- `snapAspectRatio` in `gen-node.ts`, used on model change in the canvas page.
- `wiro-contract.test.ts`: every Wiro tool in a 2026-10-15 `/Tool/List` snapshot, every typical
  node state, validated against that tool's published params.
- `eval:provider-smoke` builds kie requests through the real catalogue → choice → wireInputs
  path and adds image-with-reference.

Kie.ai requests were checked against docs.kie.ai (nano-banana-2, nano-banana-pro,
grok-imagine/text-to-video): fields and values match; no change.

Existing `ai_models` rows only gain the new `wire_spec` keys after the next sync.
