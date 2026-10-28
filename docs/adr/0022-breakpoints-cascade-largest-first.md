# Breakpoints cascade largest first, through explicit per-clip overrides

Status: accepted 2026-10-28.

## Decision

- A frame doc carries `breakpoints: [{ id, name, width }]`, each narrower than `doc.width`. The
  doc itself is the base view (`base`, named Desktop); it takes no overrides.
- A clip carries `overrides: { [breakpointId]: { [OverrideKey]: value } }`. Only keys in the
  `OVERRIDES` table in `packages/motion-core/src/motion/breakpoints/model.ts` are accepted:
  direction, wrap, gap, padding, columns, width/height sizing, column span, hidden, font size,
  text align, x/y/width/height, constraints.
- `resolveAt(doc, id)` applies the overrides of every view at least as wide as the target, widest
  first, then drops `breakpoints` and `overrides`. The result is a plain doc any renderer reads.
- `mediaQueries(doc)` lists the same overrides as `max-width` steps, widest first, for codegen.
- Nothing is automatic. A new breakpoint inherits everything; "stack on this breakpoint" is a
  user action that writes explicit `direction` and `width` overrides.

## Rejected

- **Smallest first (mobile-first min-width).** The base design here is the desktop frame people
  already draw; making phone the base would invert every existing doc.
- **One full doc copy per breakpoint.** Every content edit would have to be made N times, and
  copies drift.
- **Overrides on any prop.** Text, fills and media would vary per size silently; a whitelist keeps
  the inspector indicator and codegen's media queries finite and schema-checked.
- **Automatic reflow defaults** (auto-stack rows, scale fonts). The user decides each change;
  hidden rules are not inspectable.
- **Overrides stored at doc level keyed by clip.** Deleting or duplicating a clip would need a
  second bookkeeping pass; on the clip they travel with it.
