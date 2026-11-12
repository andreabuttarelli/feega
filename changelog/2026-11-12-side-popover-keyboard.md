# Side popovers reachable by keyboard

**Before.** `SidePopover` is appended to `<body>` and never took focus, so after opening it
with the keyboard Tab left for the next inspector control: fill hex/type/blend, colour picker,
stroke editor and effect parameters were unreachable (inspector audit #2088, cause E, 40 rows).
The stroke row (`div role="button"`) answered Enter only.

**Now.** Opened while the last input was a key and focus sits on the anchor or inside it (the
fill swatch lives inside the anchored row), focus moves to the first focusable element of the
body, else the dialog. Tab/Shift-Tab wrap inside the popover; nested popovers are separate
body children, so each scopes its own. Escape and focus return stay with `dismissible`. A
pointer press never moves focus (`last-input.ts` records the last input kind), so scrub-drag
and typing flows are untouched. The stroke row toggles on Enter and Space, only when the row
itself is the target.

**Discarded.** `:focus-visible` on the trigger: stays true when Escape put focus back
programmatically, so a later mouse click stole focus. A real `<button>` for the stroke row:
it contains buttons (eye, remove), and nested buttons are invalid.
