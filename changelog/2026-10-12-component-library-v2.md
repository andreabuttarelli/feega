# Component library v2: one surface, key fields first

## Why

User feedback on #427: the Back button in the library made no sense, and the detail listed
every field id and runtime variable — implementation details a normal user cannot act on.

## What

- `src/lib/motion/template/key-fields.ts`: the contract. `keyFieldsSchema` (max 5 field keys,
  its `.describe()` is the documentation) lives on `motionTemplateSchema.keyFields` and on the
  template mark, so an inserted instance keeps it. `splitFields` returns `{ key, advanced }`;
  with nothing declared it guesses the first three everyday fields (text, colour, media), so
  user-saved templates and old docs still get a sensible top.
- Built-ins declaring keys: prompt input (`text`, `button_label`, `theme`, `accent`), UI morph
  reel (`button`, `toast`, `accent`). `Design.keyFields` passes through `build`; the scene and
  layout designs rely on the guess for now. New templates (floating-media, feature-scroll,
  photo-strip, scroll-story, split-headline) declare `keyFields` the same way.
- `ComponentLibrary.svelte`: grid + category tabs + search; a card opens `ComponentDetail` as a
  side panel (desktop) or bottom sheet (≤640px). Esc closes the detail, then the library
  (`browser.ts::dismissFrom`); arrows/Home/End move across cards (`gridStep`).
- `ComponentDetail.svelte`: a draft instance (`starterDoc` in the chosen format) is edited
  through `FieldForm`; the first edit or a format other than the template's own swaps the
  pre-rendered video for a live `MotionPreview`. Advanced (closed) holds the other fields, the
  template id and the runtime variable names.
- Insert path: "Add to video" → `onpick(id, sounds, draft)` → `insertEntry` in the editor page →
  `insertTemplate` at the playhead → `carryEdits` copies the fields whose value differs from the
  template default onto the new instance → `apply`. Format chips only change the preview: the
  instance always lands in the video's own frame.
- `TemplateInspector.svelte`: key fields flat on top, the rest grouped under a closed Advanced.
  `VarsPanel.svelte` is a closed `<details>` "Interactive · Advanced".

## Discarded

- Replaying raw edits as strings: media lists are not set through `setValue`; carrying values
  from the draft covers every field type.
- A separate key-field label: the existing field labels are already human.
