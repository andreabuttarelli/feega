# URL import: tablet and phone breakpoints on by default

With views drawn from the narrow reads (2026-11-01-url-import-breakpoint-views) the tablet and phone
views score 0.92-0.99 fold on most fidelity pages, close to the desktop; they were opt-in at
0.49-0.96. The dialog ticks **Add tablet and phone layouts as breakpoints**, the API and MCP
`import_url` default `breakpoints` to true, and the CLI takes `--no-breakpoints` instead of
`--breakpoints`.

Costs: three reads of the page (parallel tabs, three Browserless sessions), and no section frames
while breakpoints are on (the dialog greys the sections checkbox). Unticking breakpoints gives the
desktop-only import as before.
