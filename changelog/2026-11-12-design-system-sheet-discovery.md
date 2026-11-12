# Design-system import: stylesheets from what the page loads

Spec: `docs/specs/design-system-import.md`, stage 4, item 1.

**Before.** Tokens came from a fixed list of 14 root-relative sheets (or shadcn's
`components.json`) plus their relative `@import`s. Nuxt 4 (`app/assets/css/main.css`), monorepo
apps (`apps/web/src/app.css`) and theme packages imported by name (`@acme/ui/theme.css`) were
missed: the import said "no tokens".

**Now.** The page tree script returns `styles`: every same-origin sheet the page loaded, with
Vite's `data-vite-dev-id` (absolute path of the source file) or the link's pathname, and its
CSSOM text. `readSheets` resolves each path to a repository file by trying its suffixes,
longest first (the sandbox or folder prefix is unknown to the reader and differs per runner),
and reads that file: line numbers, `@theme` and write-back all keep working. Bare `@import`s are
resolved only inside the workspace (root `workspaces` or `pnpm-workspace.yaml`, package name
checked, `exports` honoured), never into `node_modules`. A loaded sheet with no file becomes a
`page:` sheet from its CSSOM text: its tokens are read-only (`fromPage`), labelled on the board,
counted in the report, skipped by write-back. Names declared in a file win over page text.

**Design.** Token reading moved after capture (`designFor` returns a `Designer` called with the
loaded sheets) because the list only exists once the page is open. Rejected: a longer
candidate list (the next framework misses again) and listing the repository (`ReadFile` reads
files, it cannot list, and GitHub listing costs a call per directory).
