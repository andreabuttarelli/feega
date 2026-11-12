# Design-system import: type scale and shadows as styles

Spec: `docs/specs/design-system-import.md`, stage 4, item 2 (Q4 as recommended: styles hold
literals, keyed by token).

**Before.** `--text-*` and `--shadow-*` were listed as "a later stage"; plain-CSS typography
(traidue's `article .prose h2 { font-size; font-weight; letter-spacing }`) was ignored;
breakpoints and easings were "not bindable".

**Now.** The parser keeps literal `font-size` / `line-height` / `font-weight` /
`letter-spacing` / `box-shadow` declarations of plain rules (`Parsed.typed`; not in width media
queries, not with a pseudo-class, not `var()`). `design-styles.ts` groups them, and the
`--text-<n>` family with its `--line-height` / `--letter-spacing` / `--font-weight` companions,
into text styles, and `--shadow-*` / `box-shadow` rules into effect styles. One table,
`FIELDS`, says per field how a value is read, written back and matched against a layer. Each
field is one token-map entry (`<style>#<field>`, with `rule` for plain-CSS declarations), so
write-back and Pull reuse the declaration machinery: a field edit replaces exactly its line,
a Pull keeps a canvas edit unless the code changed the same declaration.

Binding follows the variables' evidence order (class, single-selector rule, unique fit) and
keeps a style only if it fits what the layer shows; the style is then defined on the doc so
the layer's values equal it and future edits propagate. Styles bind only on the page frame,
not on component-set frames, whose size unit differs.

`--breakpoint-*` (number, px) and `--ease-*` (string) are variables of an `Other` collection,
shown on the board, excluded from value binding: nothing on a layer takes them.

**Not done.** Inset shadows, `px`/`rem` line-heights in rules, font family in styles,
`--leading-*`/`--tracking-*` scales, durations (Tailwind 4 has no duration tokens), responsive
overrides (only the base rule is read).
