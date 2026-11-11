# Design-system import, stage 2: a mode per board, tokens on Pull

Spec: `docs/specs/design-system-import.md` (Q1 accepted as recommended).

**Mode below the frame.** Before, the active mode was per frame (`collection.active`), so a Dark
board kept literals. Now any clip can carry `modes: { [collection]: mode }`
(`layerModesSchema`, `variables-model.ts`). `resolveVariables` resolves each clip in the nearest
ancestor override, else the frame's mode; an unknown mode falls back. Resolution stays
materialised into props, so render, export, copy, undo and persistence need nothing new. A main
resolves in the frame's mode; an instance under an override gets the main's bound values in its
mode through `props.modeValues`, owned by resolution and merged by `overridden()` under the
instance's own overrides (nested instances recurse). Rejected: resolving modes in the renderer
(it does not know variables, and packages cannot import the app); writing the values into
`props.overrides` (resolution could not tell them from the user's). UI: the layer's Variables
section; agent/MCP: `variable` action `layer_mode`.

**Import.** A Dark board gets the Dark override and binds like the light one, checked in Dark; an
instance there drops the literal override the mode already gives. Fixed on the way: the
Components page homes were landed from the unbound plan, and the editor re-follows mains from
there, so the first edit unbound every main; followed mains are now also resolved in the frame's
own variables.

**Pull.** `token-pull.ts` matches tokens by source name (`tokenId`): added, revalued, canvas edit
kept, both-changed → code wins and the canvas value is reported, removed-but-bound → orphan
(`orphan: true`, never written back), rename only with the same values and the same usages.
Canvas-made variables, the active mode and a board's chosen mode survive. `rebased` no longer
treats bound properties as layer edits (they reported one conflict per bound layer).

**Leftovers.** A mode without a declaration is appended to that mode's block (`ThemeBlock` from
the parser), shifting origins below. The patch preview is a Myers diff with 3-line hunks. `p-N`
/ `gap-N` bind to `--spacing` × N when the repo declares `--spacing` (map entry `factor`; write
divides once). Uploaded folders read tokens from the archive. Descendant-selector `var()` rules
stay unsupported: see the PR.
