# Code frames: views, typed variables, export

**Views.** An iframe node with `sourceNodeId` + `route` renders the source
frame's files at that route (`feega.route`, also set as `location.hash`).
Placed in a row right of the source (`placeInRow`). A deleted source leaves
an explicit empty state.

**Variables.** The frame runtime exposes `feega.var(name, spec)` plus one
shorthand per type. Types live in one table (`code-vars.ts`: `VarType`,
`checkVarValue`). Values sit in `data.vars` and reach the iframe by
postMessage, so a change never recompiles: React re-renders through a
`useSyncExternalStore` host, Svelte reads a `$state` store compiled with
`compileModule`. Text vars are found by matching rendered text and tagged
`data-feega-var`; a double-click edits in place and posts back. Rejected:
asking authors to wrap text in a component (friction, and Svelte has no
equivalent).

Server writes check `vars` against declarations extracted from the source
with the TypeScript AST and `svelte/compiler` parse (`code-source.ts`):
the right bar knows types from the runtime, the server from the AST, and
both use `checkVarValue`.

**Export.** `code-export.ts` rewrites each file from its AST: variable
calls become literals or `content["name"]`, `MemoryRouter` becomes
`BrowserRouter`, `feega.route` becomes `"/"`, and a file still naming
`feega` aborts the export. Bare imports become dependencies with the npm
latest version. Verified with `npm install && npm run build` on both demo
sites, in both modes.
