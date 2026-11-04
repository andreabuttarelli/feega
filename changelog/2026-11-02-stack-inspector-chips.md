# The Stack section is chips, not a form

User feedback on the Stack section (props piled in label-left rows; per-side padding with no
way back and fields that did not say their side; min/max with no unit). Redone after the
Figma auto layout panel on #1713's chips (`NumberField`).

- `NumberField` gains `icon` (an icon instead of the text label), `trailing` (a snippet after
  the value: a mode menu) and `blank` (an empty value with a placeholder, for Auto gap).
- **W / H**: `StackSizeChip` — value, then the mode inside the chip; its menu lists the modes and
  Min / Max inputs that take `200`, `200px` or `50%` (`limits.ts`, previous commit). Set limits
  show as chips under W / H with ×; the old Min / max rows are gone.
- **Gap**: a chip with a direction icon and a Fixed / Auto select (Auto = space between, typing a
  number goes back to Fixed). The separate Distribute icons left the section.
- **Padding**: `padding-mode.ts` decides two chips or four (left, top, right, bottom, each with a
  side icon) and the toggle both ways: closing keeps the first of each pair (left, top) when the
  sides differ. Tests for both directions.
- **Advanced settings**: `StackSettings` (sliders in the section header) opens a side popover
  (`StackSettingsPanel`) with Canvas stacking (first on top / last on top, renamed from First on
  top Yes/No), Strokes included, stretch / baseline / around / evenly, wrapped lines, grid
  tracks and fill order.
- Grid columns is a chip in the section.

Child rows (Align self, In layout, grid span / cell) keep their form rows for now.
