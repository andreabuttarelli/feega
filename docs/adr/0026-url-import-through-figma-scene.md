# 0026 — URL import reuses the hosted browser and the Figma scene

## Status

Accepted, 2026-10-29.

## Context

Import from URL needs a real browser (computed styles, layout, fonts) and a DOM → doc mapping.
Options for the browser: `@sparticuz/chromium` in a Vercel function, Vercel Sandbox, a worker.
The repo already has `liveBrowser`: Browserless (remote, metered at $0.002 per 30 s unit, logged
to `ai_calls`) with local Chromium as fallback, request-fenced against SSRF, used by
`recreate_ui`. For the mapping, the Figma importer (`rest-message` → `planOf` →
`placeFigmaPlan`) already turns a layer tree into frames with auto layout, text, fills, strokes,
effects, vectors and image fills.

## Decision

- Browser: `liveBrowser`. No new function, no bigger build, nothing bundled. The page runs on
  Browserless, outside our network, so a DNS rebind past `assertPublicUrl` still cannot reach
  internal hosts.
- Mapping: `pageTreeOf` emits Figma REST nodes; `urlPlan` feeds `restMessage` → `planOf`.
  One mapping for Figma and the web, no second converter to keep in step.
- Cost: one Browserless session per import (~$0.002–0.004), metered like `recreate_ui`. Not
  gated by `gateAiAction` (no model spend); a per-user rate window instead.

## Consequences

- Fidelity gains in the Figma scene help both importers.
- Pages are read down to 65 536 px and split into still frames of 16 384 px (the design limit).
- What the doc cannot hold as layers comes in as a raster snapshot of that element only.
- Breakpoints need a second pass on the tree; not in the MVP. Repeated subtrees become components (spec, Components).
