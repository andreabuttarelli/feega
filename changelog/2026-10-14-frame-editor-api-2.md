# Frame editor actions over the API (2/n): files and templates

`exported`, `uploadFont`, `analyze`, `templateSounds` and `saveTemplate` now run through
`EDITOR_OPS` (`record_export`, `upload_font`, `analyze_sounds`, `template_sounds`,
`save_template`). The audit found MCP names in the parity table that did not run the same code:
`register_font` adds a Google family (the action registers an uploaded file), `analyze_audio`
through `motion_tool` has no analysis dependency and always answers "no analysis",
`add_template` lays sounds only on a template it inserts, and `save_template` stores the saved
head instead of the doc the editor sends.

`poster` takes a file, so it got its own multipart endpoint,
`POST /api/v1/motion/{node}/poster`, calling `savePoster`. No CLI command or MCP tool: the CLI
client sends JSON only, and the table keeps it ui-only with the route named.
