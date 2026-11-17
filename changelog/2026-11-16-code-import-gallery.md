# Code import draws the whole component library

Before, a code import made mains only from components a captured route rendered.
`component-discovery.ts` already read every library component and its declared axes
statically, and the report listed the ones no route rendered (`library.uncaptured`),
but nothing drew them.

Now the sandbox runner writes a gallery page into the clone (`gallery.ts`) after the
dev server is up: one module that `import()`s each library file, renders each
component across `galleryCells` (declared axes, defaults and `false` left out so a
cell keys like a page use without the prop, `asChild` skipped, text props filled
with the name) inside two error boundaries (with a text child, then without), and
prints `Not drawn: <Name>: <why>` when both fail. `importBoards` captures the
gallery pages after the routes, within the same 150 s budget, waiting for
`[data-feega-gallery="ready"]`; they become `Library` boards, are not routes
(not in `pages`, the map or Pull's variants), and their marks feed `codePlan` like
any page, so each component gets a full variant set on the Components page and page
uses stay linked.

Sites, one row per framework (`PLACERS`): Next App Router under the root layout,
Next Pages Router beside `_app`, Vite + React as a copy of `index.html` with an
entry beside the real one and its CSS imports. Others report
`no component gallery for <framework> apps yet`.

Decisions:
- Route `feega-gallery`, not the spec's `__feega`: Next App Router does not route
  folders that start with `_`.
- Gallery pages hold at most 120 cells (`MARK_LIMITS.uses` is 600 per page) and
  are ordered by how many of their components no route captured.
- Server-only components (`server-only`, `'use server'`, `next/headers`, `async`)
  are left out before rendering: in Next a server import in a client page breaks
  the whole page at compile time, not one cell.
- Write-back skips any source in a gallery file (`isGalleryFile` in `editsOf`).
- Folder (local mode) imports draw no gallery: it would write into the user's
  folder.
- The import map keeps `reasons` for components in code only; ImportMap shows them.

Not done: Svelte/Vue galleries, rendering Storybook stories as the gallery source,
`Icon/<Name>` mains (an instance takes its main's colour, and icons inherit
`currentColor` per use), raising `MAX_STORIES`.

Tests: `gallery.test.ts`, `gallery.browser.test.ts` (real Chrome, React 19:
cells marked with their props, a void element retried, a failure printed),
`import-code.test.ts` (gallery after routes, reasons), `write-back.test.ts`,
`import-map-of.test.ts`, `component-discovery.test.ts`.
