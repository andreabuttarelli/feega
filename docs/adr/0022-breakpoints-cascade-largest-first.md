# Breakpoints cascade largest first, through explicit per-clip overrides

Status: accepted 2026-10-28.

## Decision

- A frame doc carries `breakpoints: [{ id, name, width }]`, each narrower than `doc.width`. The
  doc itself is the base view (`base`, named Desktop); it takes no overrides.
- A clip carries `overrides: { [breakpointId]: { [OverrideKey]: value } }`. Only keys in the
  `OVERRIDES` table in `packages/motion-core/src/motion/breakpoints/model.ts` are accepted:
  direction, wrap, gap, padding, columns, width/height sizing, column span, ignore auto layout
  (`layoutItem.absolute`), hidden, font size, text align, text resizing (`props.sizing`), line
  height, text wrap (`props.textWrap`), x/y/width/height, constraints.
- `resolveAt(doc, id)` applies the overrides of every view at least as wide as the target, widest
  first, then drops `breakpoints` and `overrides`. The result is a plain doc any renderer reads.
- A view keeps pixels: text size, stroke widths and the width of laid-out children are rescaled
  from the frame's unit to the view's, so a 15px label is 15px on Phone. Override values are
  stored in the base frame's units; `liftEdit` converts an edit made on a view back before
  diffing, so an untouched round trip writes nothing.
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

## Amendment 2026-11-01: imported pages and compositions

URL import (`docs/specs/url-import.md`, Breakpoints) reads a page again at 768 and 390 px and
writes what changed as overrides. That needed three things the hand-drawn case did not:

- **Overrides on clips inside compositions.** A component's main lives in `doc.comps`; its phone
  layout is the same for every copy. `setOverride(doc, bp, clipId, key, value, comp)` writes on a
  clip of that composition, and `resolveAt` applies overrides in every composition. Clip ids are
  unique per composition, not per doc, so lookups by id stay scoped; editing on a view still lifts
  top-level clips only.
- **`layoutItem.absolute`.** A stacked row on desktop can be a column on the phone; rather than
  infer a new auto layout, the imported phone view takes each flowing child out of the flow with
  its own box.
- **`props.sizing`, `props.lineHeight` and `props.textWrap`.** A headline kept on one line at
  desktop (`textWrap: none`) wraps on a phone, and pixel line heights change with the font size.
- **A breakpoint's own height.** `Breakpoint.height` is optional; when set, `resolveAt`
  restretches the view to it (clip y/height keep their pixels) and `liftEdit` restretches an edit
  back before lifting it. A phone page runs longer than the desktop one; without it the view kept
  the desktop height and cut the content it pushed down.

## Amendment 2026-11-01 (2): an imported view is the narrow read, planned

Moving the desktop layers to the boxes a narrower read gave them topped out far below the desktop
fidelity (tablet fold 0.49-0.96, phone 0.53-0.90, capture `v4`): the narrow page words a headline
differently, swaps pictures (srcset), builds menus from other elements and runs longer than the
frame maximum, and none of that is a box. Now each narrower read is planned on its own, at the base
frame's units per pixel, and merged into the base doc:

- A base clip and a view clip from the same element (`RestNode.key`) are **one layer** when they
  differ only in layout keys. The view's values become overrides and, inside an auto layout, the
  layer leaves the flow at its captured box (`layoutItem.absolute`, fixed sizing): the view shows
  the page's layout, not a reflow of the desktop one.
- Every other layer of the view comes in as a **view-only layer**: hidden at base and in the other
  views, shown in its own (its subtree and compositions with it), slotted below the next matched
  layer of the view's paint order. Base layers with no counterpart are hidden in that view.
- A view runs as tall as its read. `Breakpoint.height` may exceed the frame maximum; the doc's own
  height is still capped. Lowering the units per pixel so a tall phone page fits blurred the desktop
  (stripe full 0.981 → 0.962 at 0.5 units/px) and was dropped.
- Override keys gain **letter spacing**, **font axes** (`'opsz' 40` at a 40 px size) and the
  **outline** (`props.path`): a rounded box's outline is stored relative to its box, so a box resized
  at a breakpoint needs its own outline to keep its corner radius in pixels.

Rejected: overriding text, fills and images per view (the whitelist would cover content, and the
inspector could no longer tell a layout change from a content change); one doc per view (edits made
N times); replanning the view and matching clips by order (532 mismatches on feega.app).
