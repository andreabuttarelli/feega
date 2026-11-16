# Code import reads the whole token side

Before: the import read CSS custom properties and token JSON only. Tailwind 3
configs (`tailwind3.ts` existed with tests and no caller) and SCSS/LESS
variables were never read, and 64 variables per collection / 40 styles dropped
the rest of any real theme.

Now:
- `tailwind-config.ts` reads `tailwind.config.*` as text (TS parser, no
  execution), merges `extend`, records each literal's line. Non-literals are
  listed with their line. `hsl(var(--x))` becomes an alias of `--x`.
- `sass-vars.ts` reads `$x` / `@x` literals and references from the usual
  `variables` files.
- Write-back for both: the literal is edited in place; a doubled literal on one
  line is refused (the code wins).
- Limits: 512 variables, 16 collections, 200 styles (modes stay 8). They were
  schema constants only; every consumer reads them, panels list rows uncapped.
- `calc()` of plain numbers folds to a value. A token inside a width media
  query is reported as a responsive value.
- Code imports adopt their variables and styles into the project library, as
  URL imports do.
- Coverage: `coverageOf` counts declared vs imported names per kind;
  `tokenCoverage` in `scripts/eval/code-import` is no longer unrun.
- `TOKEN_SOURCES` deleted (no consumer, contradicted the code).

Discarded: evaluating the Tailwind config in the sandbox (adds defaults the repo
did not declare, costs a run); per-side padding and per-corner radius binding
(the model has one `autoLayout.padding` and one `radius` target); a speculative
evaluator for JS themes (MUI, Chakra, Emotion): what they expose as runtime CSS
variables is already read.

Not imported, listed per import: `--font-weight-*`, `--leading-*`,
`--tracking-*`, inset/drop/text shadows, opacity, tokens that read `var()` in a
`calc()`, responsive values.
