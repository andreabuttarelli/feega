# Variable bind chips

Binding a variable to a layer needed the Variables section: pick a variable, pick a target from a second list, press Bind. Gap audit row 10 (figma-jitter-gaps): no per-field bind chip.

Now each colour, number, text and toggle field of the inspector has a chip. Click it, pick a variable of the matching type (the doc's own plus the canvas library), done. A bound field is replaced by a pill with the variable name, its value in the active mode and an unbind button. Values follow modes because the binding already re-resolves on every mode switch.

- `bindChip` (`src/lib/motion/variables.ts`) is the view model: type from `typeOfTarget`, the options of that type, the bound key. No chip when no variable of the type exists and nothing is bound.
- `bindFromLibrary` (`variable-library.ts`) adopts the canvas collection into the frame and binds; `VariablesSection` uses it too instead of its own copy.
- The fill stack of a shape or text hides the legacy `fill` / `color` keys, so the chip sits on the stack and targets the key it replaces (`fillTarget`). Resolving such a binding now drops `fills`: with a stack stored, the bound colour was never drawn.
- Agent tools `bind_variable` / `unbind_variable` are the chip, as direct tools next to the `variable` action tool. Parity rows added in `ui-actions.ts` and the clip `bind` row.

Discarded: a chip for booleans only on toggles with `Control.Toggle` was kept (same registry, `CONTROL_TYPE`); a chip on the grid number fields (transform) is not added, they are not variable targets.
