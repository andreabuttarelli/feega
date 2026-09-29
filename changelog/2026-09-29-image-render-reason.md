# Image renders say why they failed

`runImageJob` caught every `renderPostImage` throw and returned a bare
`render_failed`. `eval:gen-node` hit it (on main too): the disposable org
had no credits, the gate threw `CreditsExhaustedError`, and the node
showed only `render_failed`. The thrown message now travels as `reason`,
which `runGenNode` already writes as `render_failed: <reason>`.

Eval changes: the disposable org gets welcome credits like a real signup;
scenario C matches the new model resolution — an unknown model is refused
before any `node_runs` row, with suggestions — and the started-run failure
and version race use an empty prompt (`prompt_required`, no spend) instead
of an invalid model.

Not the cause: the bare id `gpt-image-2.5-flare`. It is the catalogue id
and renders fine once credits exist.
