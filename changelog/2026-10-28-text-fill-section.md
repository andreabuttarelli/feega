# Text fill moves to the Fill section

Before: `fieldSection` routed `color`/`fills` of typed elements to the Text
section (via `TEXT_KEYS`), and `textBody` drew them under the type controls.
The right bar showed a text colour in Text while every other element used Fill.

Now `color` and `fills` are not text keys: they fall to `CONTROL_SECTION`
(Fill), so text uses the shared `FillStack`/`ColorField` and the Figma-style
picker. The Text section no longer renders a colour row.
