# The core owns the doc; TS sends ops

## Problem

TS builds display lists and overlays, stringifies them, and the core parses them again. The
state lives twice (JS objects and core items), every crossing pays stringify + UTF-8 encode +
copy + serde, and caches exist on both sides to avoid resending. Measured payloads on landings:

| crossing | bytes | when |
|---|---|---|
| `append_group_packed` | ~60 MB | load |
| `set_overlay` (fixed) | ~981 KB | every selection change |
| `patch_group` splice | ~60 KB | every nudge |

## Target

The core holds the display-relevant projection of each frame doc. TS sends:

- **load**: one compact binary blob per frame (f32 contours where precision allows);
- **edits**: the `DocOp`s `diffDoc` already produces (`src/lib/motion/doc-ops.ts`), binary;
- **overlay**: keyed chunk ops, never whole lists.

The core derives display lists, splices and overlay groups itself. Point 4 (fast patch in the
core: which nodes changed, local relayout through the Rust layout owned by the layout work,
subtree redraw, splice) sits on top of the doc ops.

## Stages, each behind a switch until parity holds

| stage | crossing replaced | switch |
|---|---|---|
| c1 | overlay as keyed chunks: `overlay_chunks({put, drop, fixed?, selected?})` | `?overlayOps=1` / `feega:overlayOps` |
| a1 | packed load with f32 contours | — |
| a2 | binary frame doc, core builds the list | — |
| b | `DocOp` binary, core applies and splices | — |
| 4 | fast patch decided and laid out in the core | — |

### c1: overlay chunks

`world-overlay.ts` already memoizes overlay items per key (`wire:<id>`, `chrome:<id>`,
`state:<id>`), with stable array identity when unchanged. The core keeps one map key → items
shared by the fixed and selected parts, plus each part's key order. A selection change moves
keys between parts (order arrays only) and resends the few chunks whose look changed (linked
wires, the selected tile's state chrome). The live part stays a whole list: it is small and
rebuilt every gesture frame.

### Interface with the layout work (points 2–3)

The core's fast patch calls layout as `fn relayout(doc: &FrameDoc, dirty: &[NodeId]) ->
Vec<(NodeId, Rect)>`. Until that lands the patch path keeps TS layout and sends the
resulting `DocOp`s.

## Measures per stage

Landings and the heavy canvas copy, desktop and 4x CPU: edit bench p50/p95, boundary bytes
per edit and at load, load TTI, JS heap and WASM memory, zoom fps and frames over 8.3 ms, the
9-run flicker check (0 dips). A stage that does not gain measurably does not merge.
