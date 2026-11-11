# Code import: CSS tokens become linked variables (design-system import, stage 1)

Before, code import resolved every CSS variable to a value: `codePlan` ran `urlPlan` with
tokenising off, so an imported board held literals and an edit wrote the element, never the
token. Spec: `docs/specs/design-system-import.md`.

Now, with **Design system** on (default when tokens are found):

- `css-tokens.ts` reads the stylesheets as text (candidates + relative `@import`, or the file
  shadcn's `components.json` names; ≤24 files, ≤512 KB each). A small tokenizer, not `postcss`:
  `postcss` is only a transitive dependency and Stage 1 needs blocks, declarations and positions,
  nothing else. Selectors map to modes in one table (`MODE_SELECTORS`).
- `design-tokens.ts` classifies by name (`TOKEN_ROWS`: one row per prefix, with the reason a row
  is left out), maps source names to variable names in one place (`variableName`), keeps
  `var(--x)` as an alias, caps at 8×64×8 keeping class-used tokens first and lists the rest.
- `design-bind.ts` binds layers: utility class → `var()` rule with a single compound selector →
  a value only one token holds in any mode. Every candidate must also match the captured value in
  the board's mode. Boards captured in another scheme stay literal (mode is per frame; Q1).
- `design-board.ts` builds the Design system board as one more capture, so `urlPlan` lays it out
  like a page; swatches and radius squares are bound by name.
- `token-write.ts` writes a changed mode value at its declaration's line, in the source format
  (hex/rgb/hsl/bare hsl/oklch/px/rem/var()); code wins on a moved declaration. `editsOf` no
  longer writes a bound property into the template.
- The token map lives in `nodes.data.code.tokens`; a folder publish updates its `raw` so the next
  diff starts from the written text.
- `TOKEN_SOURCES` (next to `CONDITION_AXES`) says which token sources are read and why not.

Discarded: reusing URL import's value clustering (invented names, no modes); binding dark boards
to the same variables (they would show the Light value until per-board modes exist).

Not in this stage: per-board mode, Pull reconciliation of tokens, type scale/shadow styles,
Tailwind v3 config, font family binding, spacing from `--spacing` × n.
