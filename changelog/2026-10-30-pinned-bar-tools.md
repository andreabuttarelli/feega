# Bottom bar pins the essentials

The unified + menu (2026-10-29) put every tool and every Generate node two clicks away. The
frequent ones are now direct: select, rectangle, ellipse, text, pen, frame, then Generate text,
image, video and sound. The + menu is unchanged.

## Decisions

- `bottom-bar.ts` owns one table, `MODE_SLOTS`, saying which slot each editor mode shows. Play and
  Code are read-only: no Draw, no Generate. `insertSections(context, mode)` reads the same table, so
  the + menu and the phone Insert sheet drop their Tools and Generate sections in those modes.
- Below 1040 px (`BAR_COMPACT_QUERY`) both groups collapse into +. Phones keep the Insert sheet,
  where Tools and Generate are already the first two sections.
- Pinned Generate buttons reuse the + tiles: click calls `onpick` (optimistic insert), drag sets
  `CANVAS_DRAG_MEDIUM`. Pinned tool buttons set `frameBar.tool`; shortcuts are untouched.
- Discarded: duplicating the groups at the top of the phone sheet. They are already there.
