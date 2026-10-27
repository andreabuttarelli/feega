# Run a technique on a list

A saved technique ran once, on the texts wired into it. Running it over many
inputs meant placing it again and again.

`runRows` (technique-instance.ts) takes rows of cells and a column mapping,
and per row writes the technique graph on its own band of the Technique runs
canvas and queues it as its own workflow. Cells fill text and doc slots as
before; image, video and audio slots take a URL in `data.url`
(`withInputs`). `previewRows` prices the batch from the plan's generative
nodes before anything is written; the page action and the op are gated like
every other spend. Progress counts the run rows; cancel stops every workflow
of the batch.

Surface: selection menu "Run on a list…" (dialog with paste, CSV file,
mapping, cost, progress), canvas ops `preview_technique_rows`,
`run_technique_rows`, `technique_rows_progress`, `cancel_technique_rows`.

Decided: at most 50 rows per batch; the parser is a line splitter with
quotes, not a CSV library; the rows share one plan per row rather than one
node with a list, so each row's group can be inspected and rerun alone.
