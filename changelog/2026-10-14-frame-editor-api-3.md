# Frame editor actions over the API (3/n): the spending ones

`sound` and `renderBatch` had no API: the parity table pointed both at `ask_motion_agent`, a
model turn that may or may not end in the same call. They now run through `EDITOR_OPS`
(`generate_sound`, `render_batch`), and the credit gate is called inside the op through
`ctx.gate`, so no caller can skip it: the page passes the form gate, the endpoint the API-key
gate. Both answer 402 `credits_exhausted` the same way (tested on the real `cli-auth`, only
`gateOrgCredits` faked).

`parseSettings` and `batchInput` split into a JSON step and `settingsFrom`/`rowsFrom` on values,
so the endpoint validates the same way from JSON. One message changes: rows that are not JSON at
all now say `invalid_rows: 1 to N rows of { name, values }` instead of `invalid_rows`; the editor
always sends `JSON.stringify` output, so it never reaches that branch.
