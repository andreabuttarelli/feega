# Element states on the canvas

Inspector gets a States section (`StatesSection.svelte`): Default/Hover/Pressed/Focus switcher
that previews the state on the canvas (`statePreview` → `previewDoc` in GpuFlow's show/saved/commit
paths, never saved), per-state property rows, curve picker (`EasePicker`, now any ease or bezier)
and duration. A "+" below a selected component instance appends a variant (`appendVariant`).
The prototype player tweens hover/press with `amountAt` + `mixState`. React export prefixes state
classes with `hover:`/`active:`/`focus-visible:`.

Discarded: a REGISTRY row (states live inside the frame doc, already optimistic through
`FrameEditSession`); one variant per state.
