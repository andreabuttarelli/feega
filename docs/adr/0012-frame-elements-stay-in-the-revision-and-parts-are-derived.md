# Frame elements stay in the revision JSON; poster parts are derived from data

Context: Layers listed a poster's parts (a title step, a photo, a footer column) only after
rendering the poster in a hidden player and reading `data-part` from its DOM (`PartsProbe`):
seconds per canvas, one player per poster, and nothing to select until it finished. The user asked
for every element to be addressable as data, at once. Two questions: where elements live, and how
parts become data.

## Where elements live: the revision JSON, ids indexed

Considered: a `frame_elements` table, one row per clip/part, with realtime and an optimistic
`version` per row.

| | rows | revision JSON (kept) |
|---|---|---|
| Two people, different elements | per-row version | already solved: ops by id, rebased on the head (ADR 0007); different clips and props commute |
| Per-element MCP/API edit | `update ... where id` | the same ops (`clip.set`, `clip.entry`) through `commitOps` |
| History and undo | a second log to keep in step with `motion_revisions` | one log; undo is a revision (#519–#523) |
| Export, render, agent tools | rebuild a doc from rows on every read | read the doc as today |
| Migration | every frame, every writer (~90 tools, editor, agent, MCP) | none |

Rows would duplicate what ADR 0007 gives and split one source of truth into two. Kept: the
revision JSON is the only source; element ids are its index.

## How parts become data

A poster part has no row in the doc: it is what the template's view tags with `data-part`, a
function of the props (`title:3` exists because `title` has four lines). The view code is the
template's definition of its parts. Writing a second, hand-kept `parts(props)` per template would
be two definitions that drift.

Decision: the server derives parts from the doc alone (`staticParts`), by running the built-in
view against a DOM-less document (linkedom: no layout, no fonts, no player, a few ms per poster)
and reading the tags. Only sources identical to a built-in template run: a component written by an
agent or a person is never executed on the server. The canvas load and `frame-outlines` return
the parts with the elements, so Layers lists and selects them before any preview exists; the open
editor takes them from the same outline, measured parts only filling gaps.

Still measured in the browser, by design:

- boxes (where a part sits) for hover and selection outlines on the stage: lazy, never for listing;
- parts of a component that is not a built-in: `PartsProbe`, as the legacy fallback. It is never
  mounted when the outline already names the parts (`posterHeads`).

Consequences: changing a built-in view changes its parts with no migration; a doc whose
component source no longer matches the current built-in falls back to the probe until it is
re-inserted.
