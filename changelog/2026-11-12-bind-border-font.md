# Variables: border width and font family are bindable

Spec: `docs/specs/design-system-import.md`, stage 4, item 3 (Q3 and Q6 as recommended).

**Why they were excluded.** Font: `Control.Font` had no variable type, and a CSS token holds a
stack (`'Inter', system-ui`) while a layer holds one family. Border: shape props are
frame-relative and imported borders live in the `strokes` stack, so binding the `strokeWidth`
range to a px variable would have written 2 into a 0–0.2 field and missed the stack. Both
reasons are handled, not ignored: `font` resolves the first family of the stack
(`TARGET_VALUES`), and a new `border` target converts px through the frame's short side into
every stroke of the stack and `strokeWidth` (`SHAPED_TARGETS`, next to `radius`). The existing
`strokeWidth` binding keeps its old meaning, so no saved doc changes.

**Import.** `--border-width-*` and names with `border-width`/`stroke-width` are a `Border`
collection; `border-width` and `font-family` `var()` rules are evidence. Font binds by class or
rule only, never by value (one family usually backs several tokens: traidue's `sans` and
`heading` are both Inter). The board shows a Border section.

**Not done.** Binding a family does not register its font files: a variable switched to a font
the frame does not have renders with the fallback until the font is added.
