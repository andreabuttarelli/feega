# Node overlay controls, one system

Before: `SelectionToolbar` rendered native `<select>`s (empty when a value was
unset), bare checkboxes, an unlabeled number input, and a model menu squeezed
to the trigger's width. The bar could leave the viewport; on mobile it scrolled
sideways and hid actions. Effects and composition editors had their own param
controls (round knobs, native selects) duplicated file for file.

Now:

- `src/lib/components/ui/popover` — bits-ui popover, collision padding, flips
  and shifts, capped at the available height.
- `src/lib/components/ui/control` — `Segmented`, `RatioChips`, `Switch`,
  `SliderField`, `NumberField`, `OptionMenu`/`ListMenu` (searchable, arrow
  keys, Enter), `ColorField`, `ControlRow`. Rows 32px desktop, 44px mobile.
  Every control takes `ControlProps`.
- `canvas/node-controls.ts` — selection + model → descriptors. Kind comes from
  data: enum ≤4 → segmented, else menu; aspect ratio → ratio chips; boolean →
  switch; number range ≤1000 → slider, else number field (seed). Section:
  Output or Advanced (collapsed), table `PARAM_SECTION`. `patchOf` returns the
  same patch shape `commonChange` already writes — tested per field.
- `SelectionToolbar`: Model menu (provider logo, tier badge, price, why) ·
  Settings popover (trigger shows the summary) · Run with cost · secondary
  icons · overflow · delete. Order and grouping from `SELECTION_ACTIONS.group`.
  Position clamped by `toolbar-position.ts`.
- Run in the bar uses `run-quote.ts`, extracted from `GenNode` so both show
  the same label, price and gate.
- `ConnectPicker` is a popover anchored to the selection; `NodeReferences`
  uses `Dialog` and `Segmented`; `NextStepChips` clamps to the viewport.
- `EffectParamControl`/`CompositionParamControl` → one `StudioParamControl`.
  Knob helpers deleted.

Unset aspect ratio shows "Auto", not the first option: the first option is not
what gets sent.

Not done: `repeat` has no control — without an iterate axis it runs nothing,
and a control that does nothing is worse than none.
