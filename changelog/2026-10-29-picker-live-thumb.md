# Colour picker thumb tracks the pointer

Regression from #1587. During a drag the committed value is held, but the picker's effect
re-synced its local HSB to that stale value, so the thumb stayed put until release.

- `ColorPicker.svelte`: the sync is skipped while dragging; opacity is held locally too.
  Thumbs and track tint read the local colour.
- `ColorField.svelte`: the chip and hex show the last picked colour until the value prop changes.
- NumberField already shows its own scrub value; unchanged.
- Tests: thumb moves on pointermove with the prop held (square, hue, opacity).
