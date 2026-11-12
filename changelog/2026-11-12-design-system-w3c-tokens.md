# Design-system import: W3C design-tokens JSON

Spec: `docs/specs/design-system-import.md`, stage 5 (tokens JSON).

`json-tokens.ts` reads W3C design-tokens files (`$value`, inherited `$type`, `{a.b}` aliases;
legacy un-prefixed `value` is not read) from a fixed candidate list plus literal paths in a
Style Dictionary config's `source`. Each token becomes a `Declared` in the same pipeline as
CSS: the path is the CSS name, an alias becomes `var(--…)`, a file named `*dark*` is the Dark
mode. Positions come from the `"$value"` keys, matched in depth-first order. JSON declarations
come after CSS ones, so the source of truth wins over the CSS it generates.

Write-back gained a format table in `token-write.ts` (`FORMATS`): `.json` locates through the
JSON parser and replaces the quoted `$value` on its line; aliases and `{ value, unit }` objects
are refused (reported as changed). Not done: globbed `source` paths (the reader cannot list
directories), Tokens Studio `$themes`, composite tokens as styles.
