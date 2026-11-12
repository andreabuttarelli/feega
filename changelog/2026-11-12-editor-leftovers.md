# Editor: five usability leftovers from the inspector audit

**Text picking.** The audit read a click on the empty part of an imported text as picking by
glyphs. Picking already uses the layout box (`FramePlacements`: the full box for a fixed-width
text, the drawn words for an auto-width one). The imported Stripe excerpt's text overhangs its
card, which clips; the part that "missed" is clipped away, and the held pill answered through
`pickHeld`. A guard test keeps box picking. The two-double-click difference is depth, not
import: double-click drills one level at a time for every container, text included, so a text
nested six stacks deep needs the drills a hand-made nested text would. Rule kept: a double-click
edits a text only when it is the selection or at the current level. What changed: the editor no
longer opens with the whole text selected; the caret lands at the character nearest the
double-click (`caretOffsetAt`, `openingSpan`). Enter keeps select-all.

**Zoom keys from Layers and the toolbar.** `REACH` lists the view-only commands (fit, 100%, zoom
to selection, in, out) for the layers and commands regions. Panels stay as #2097 left them: a
right-bar control could own `+`/`-`.

**Selection colours.** Rows were keyed by colour, so recolouring a row destroyed it and its open
picker, and focus fell to `body` (Tab then selected another layer). `ColourRows` (one list for
the frame, multi-selection and layer inspectors) keeps a row's key across its own swap, merges
and same-colour picks included.

**Font picker.** Rows meet `--ui-hit`; the panel is on the Escape stack; search takes focus and
selects the last query on open; arrows walk search and rows; Enter in search picks the top
match; closing returns focus to the font field, which is what kept Tab off the canvas.

**Move earlier / later.** Nothing covered them: on a lone stack child both were disabled, and a
disabled `IconButton` has `pointer-events: none`, so the row answered the sweep. A lone child has
nowhere to move; the pair is hidden then.
