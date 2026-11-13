# Import this folder imports the project, not only `/`

`feega.importFolder` and `npx feega --import` posted `routes: ['/']`, so a whole project landed as
one page, although route discovery (`GET .../code-import/routes`) existed.

`npx` now discovers first and imports every static route up to the server cap (20). Dynamic routes
without a value, routes over the cap and pages that did not open are printed with the reason. No
router found falls back to `/`. Monorepos answer `choose_app` (409): a terminal asks, otherwise
npx prints a `feega:event` line and reads the choice from stdin, which the extension answers from
`showQuickPick`. `--routes <list|all>` and `--app <path>` mirror the CLI.

The extension reads `feega:event` lines from npx stdout (imported, choose-app), shows "Imported 12
pages; 3 need a value. Canvas: <file>", and once per workspace offers to add `*.feega` to
`.gitignore` (asks, never writes silently).

Discarded: sending `routes: "all"` and letting the server pick. It would refuse above the cap
instead of importing the first 20, and the client could not report what was left out.

Takes effect once `feega` is released to npm: the extension runs `npx feega@latest`.
