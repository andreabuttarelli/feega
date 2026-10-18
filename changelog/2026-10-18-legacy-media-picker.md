# Frames saved before the media picker get it too

Complaint (dev): composition/template props still showed "Image or video (id or link; video:id)"
as a text field after #663. Cause: a doc stores a snapshot of its custom component's
`propsSchema` and of its `fields`. Frames inserted before #663 kept the old plain-string spec
(no `format`) and a `text` field, so the inspector and the Fields panel drew a text input.

- `src/lib/motion/legacy-media.ts`: on load (`upgradeDoc`), a string prop with no format whose
  title carries the old hint (`(asset id or link)`, `(id or link…)`) becomes `media-item`
  (image-only for the first), the hint leaves the title; the `text` field exposing it becomes
  `asset`. Idempotent, so no `DOC_VERSION` bump: a v6 doc would be refused by code still on v5.
- Stored values are untouched: asset id, `video:<id>` or a link.
- Discarded: refreshing every stored schema from the built-in library — it would overwrite
  components a user or agent edited.
- Tests: `media-props.test.ts` (every built-in and template media prop maps to a picker control,
  no title asks for an id or link), `doc.test.ts` (legacy specs and fields load as media),
  e2e `media-picker.spec.ts` (legacy frame: upload, link, both survive a reload).
