# Inspector number fields: decimal point, Enter, Esc

Audit findings H1, H4, H5.

- H1: inputs inherit the body's `-0.05em` tracking through the Tailwind reset; BDO Grotesk's period is 0.196em wide, so it vanished between digits. `letter-spacing: normal` on every inspector input.
- H4: Enter kept focus in the field, so Cmd+Z hit the browser's text undo. Enter now blurs (commits through `change`).
- H5: Esc did not stop at the field. `fieldKeys` (`src/lib/motion/field-keys.ts`) reverts to the value at focus, blurs and stops propagation.

`fieldKeys` is attached to every number and text input in the inspectors and to the shared control `number-field`. NumberField's own Enter/Esc branches were removed. Conversions untouched.
