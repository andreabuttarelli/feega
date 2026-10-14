# Auto layout in the frame editor

The editor side of ADR 0008.

- ⇧A (`Command.AutoLayout`, also in the Layer menu): wraps the selection in a new container; on a
  lone clip that already has children it turns that clip into the container.
- `AutoLayoutSection.svelte`, self-contained under the inspector sections and built on the shell
  primitives (Section, Field, SegmentedControl, IconButton): direction (row / column / wrap), a
  3×3 alignment grid plus space-between, gap (and gap between lines when wrapping), padding per
  side, width/height sizing fixed / hug / fill (fill only inside a container), min/max, absolute,
  move earlier/later, take out.
- `AutoLayoutOverlay.svelte`: on a selected container, padding sides and gaps are drag handles
  (`layoutStrips` / `dragStrip` in `layout/guides.ts`).
- Dragging a child in the preview reorders it on drop (`reorderAt`): the transform drag still
  previews the move, the drop writes `order` instead of an offset. Absolute children move freely.

Seeded e2e not run: production Supabase was stalling on teardowns, so the run is skipped and
covered by component tests (section render, overlay mount + drag) and the pure-function tests.
