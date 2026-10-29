# Import from code

Status: accepted 2026-10-29. ADR: [0028](../adr/0028-code-import-runs-the-app-and-reads-fibers.md).

Paste a GitHub repository URL and a route, get an editable frame where every component of the
codebase keeps its identity: `<Button variant="outline">` is an instance of the main component
`Button`, variant `variant=outline`. Exported back to React, the frame uses the same names and
props.

## Flow

UI "From code…" / `POST /api/v1/projects/:id/code-import` / op `import_code` (MCP `edit`, CLI
`feega canvas import-code`) → `importCodeInto` (`src/lib/server/code-import/canvas-import.ts`)
→ `RepoRunner.start` (Vercel Sandbox: shallow clone, install, dev server on an exposed port)
→ repo component names (`componentNames`, read from the clone) → `importPageAt` on the
sandbox URL with the names → in the page, `componentMarksOf` stamps the root element of each
component usage and returns its name and props → `pageTreeOf` carries the stamp on the node →
`withComponents` turns usages into variant sets → Figma importer: first render of each variant
is the main, every other render an instance → frame doc → `nodes` + `motion_revisions` →
sandbox stopped.

## What is a component

A React function, class, `memo` or `forwardRef` component whose name is declared in a `.tsx` /
`.jsx` file of the repo outside `node_modules` (`function Button`, `const Button =`). Library
components (Radix `Slot`, router `Link`) are not components of the codebase and stay plain
layers. Read from the React fiber attached to each DOM element (`__reactFiber$…`): no plugin,
no change to the repo's build.

A name declared in the repo but also imported from a package anywhere in it (`Users` page and
`Users` icon from `lucide-react`) is ambiguous and skipped.

A usage is the component's first host element. A component whose render has more than one root
element (a fragment) is skipped; when two components share a root element the outermost one
wins and the inner one is not recorded.

## Props → variants and texts

Per component, over all its usages on the route:

| Prop | Becomes |
|---|---|
| boolean, or string matching `^[a-z][\w-]{0,23}$` with at most 8 distinct values | variant axis; an absent prop is the value `Default` |
| any other string, and `children` always | text property of the main, overridden per instance |
| functions, objects, numbers, `className`, `style`, `id`, `key`, `ref`, `href`, `src`, `alt`, `on*`, `aria-*`, `data-*`, `asChild` | ignored |

The first render of each variant combination is its main; mains of one component share the set
(`component.set` = component name) and declare a text property per text prop found in their
layers (`properties.children`). Another usage of the same combination builds its own layers and is
diffed against the main (`instance-diff.ts`, shared with URL import's repeated blocks): top-level
differences become overrides (geometry too, for a text or the auto layout container: layout
reflows them); text (and text box) differences inside nested comps become nested
overrides (`overrides` of the inner Precomp, `nestedOverrides`). Any other difference leaves the
usage plain layers, reported; its own nested components still link. Nested components first seen
inside a linked instance get no main of their own. At most 64 variants per set.

Code import skips URL import's `repeatedOf`: identity comes from the code, not from look-alikes.

## Round trip

Codegen exports a variant set as one component named after the set, with a variant prop per
axis, dispatching to one implementation per variant (`Button` → `ButtonOutline`, …). Instances
export as `<Button variant="outline" children="Cancel" />`; `Default` values are omitted. React
and Svelte; HTML inlines components as before.

## Fixes this needed elsewhere

- `pageTreeOf` read only `rgb()`; Tailwind 4 computes `oklch()`, so every fill and text of a
  Tailwind 4 page vanished. Non-rgb colours are painted on a 1×1 canvas and read back.
- `MAX_COMP_DEPTH` 8 → 24: an app page nests components deeper than 8.
- `compBounds` measured a comp whose top clip is another instance as the whole frame; it now
  asks the nested instance's content, so an instance of a wrapper component lays out in auto
  layout like what it shows.

## Measured (shadcn-admin `/`, 2026-10-29)

113 usages → 40 components, 43 variants, 13 instances. SSIM above the fold 0.426, the same as the
same page through URL import without components (0.426): identity costs no fidelity. Sandbox up in
12–18 s, whole capture 27–34 s.

## Rules

- Public `https://github.com/<owner>/<repo>` only in the MVP; `ref` optional (branch, tag, sha).
- The repo's code never runs on our servers: clone, install and dev server run in a Vercel
  Sandbox, outside our network, with no environment variables of ours. The browser that reads
  the page is the hosted one (`liveBrowser`), fenced like URL import.
- Caps: sandbox 6 min wall clock, 4 vCPU; install 4 min; dev server ready in 90 s; repo files
  scanned for names 4 000; then the URL import caps (1 500 nodes, 3 840 px, 60 images).
- Package manager from the lockfile (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`, else npm). Dev
  script: `dev`. Port read from the dev server output, fallback 5173 / 3000.
- Cost: one sandbox (~$0.01–0.03 per import at Vercel Sandbox CPU pricing) + one Browserless
  session. No model call, so not `gateAiAction`; 2 imports per user per 10 minutes.

## Not in the MVP

- Private repos. Plan: the user's GitHub fine-grained token, used server-side to fetch the
  tarball (`source: tarball` from a short-lived signed URL), never written into the sandbox.
- React Server Components (Next App Router pages without `"use client"`): they leave no fiber.
  React 19 dev builds expose them in `_debugInfo`; next step.
- Svelte (`__svelte_meta`), Vue (`__vueParentComponent`).
- Storybook URL: stories already enumerate components × args; cheaper (no install) and covers
  components the route does not render.
- Components not rendered on the route; environment variables the app needs to boot.
