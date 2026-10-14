# Properties panel: colour formats, value scrub, parts, shell tokens

Follow-up to `2026-10-14-properties-panel.md`.

- `ColorField` has HEX / RGB / HSL channels (`channelsOf`/`fromChannels` in `colour-field.ts`), the
  browser `EyeDropper` when present (`Action.SampleColour`), and an opacity input shown only when the
  caller passes `onalpha` — props store hex only, so the FillStack layers (#548) are the first caller
  with an alpha to keep.
- `NumberField`: dragging the value scrubs once the pointer moves past 3px (`gestureOf`), with
  pointer lock; a press without movement focuses the input. Keyframe diamonds are 5px, faded until
  the row is hovered or keyed.
- `UI_HIDDEN` in `inspector-sections.ts` hides the runtime variable prefix. A photo part
  (`PartField.Alone` in `inspector.ts`) shows its own and `photo*` fields only, not the poster's
  shared Style/Layout.
- Shell tokens from #539: `--ui-input`, `--ui-divider`, `--ui-row`, `--ui-header-h`, radius `sm`
  for fields, `md` + `--ui-shadow-float` for the colour popover; `SegmentedField` wraps the shell
  `SegmentedControl`; Effects adds through a "+" shell menu in the section head.
- Section bodies are `minmax(0, 1fr)` grids: a wide font picker pushed every row 7px past the
  panel on the canvas.

`properties-panel.spec.ts` ran against production in test-account mode (#547): both cases green,
including full height and no horizontal overflow at 1280×720.

Not done: hiding legacy fill fields when FillStack is present — #548 changes `MotionInspector`
itself and owns that switch.
