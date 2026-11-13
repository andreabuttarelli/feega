# Folder import installs dependencies and shows its steps

**Why.** Importing a folder with no `node_modules` (traidue.com: SvelteKit, bun.lock and
package-lock.json) failed with "the dev server … did not answer". The local path
(`folder-source.ts`) never ran the install the plan computed — only the cloud sandbox did — so
`bun run dev` died at once on a missing `vite`, and with `stdio: 'ignore'` the user waited 90 s and
saw nothing.

**Now.**
- `withDevServer` installs with the plan's manager when the install dir has no `node_modules`
  (5 min cap), and its failure carries the install output.
- The dev server's stdout/stderr are kept; a dev server that exits fails at once, and the error
  carries the last 2 000 chars of its log.
- Locally the server prints `feega:event` steps (`dependencies`, `dev-server`, `page` N/M); the
  launcher adds `find` with the page count.
- The VS Code loading screen is a step list (pending/active/done/error). Error: red step, reason,
  log tail, Retry. Old launchers are read from their plain lines (`looking for…`, `importing …: N
  pages`, `folder import failed: …`, also on stderr). For an import the canvas replaces the list
  only after `imported`.

**Discarded.** Picking npm over bun when both lockfiles exist: bun was on PATH and installed fine;
the lockfile order stays.
