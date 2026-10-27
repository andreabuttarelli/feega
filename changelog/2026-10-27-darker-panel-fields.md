# Fields sit darker than the panel

**Before.** In dark mode `--ui-input` was `--grey-4`, the same step as `--ui-panel-raised`, the
floating right bar. Number fields, selects and the segmented track vanished into the bar; only
the focused one (accent wash) showed.

**Now.** One token moved: dark `--ui-input` is `--grey-2` (one step under the timeline and panel `--grey-3`) and `--ui-input-hover` `--grey-3`, below
both `--ui-panel` and `--ui-panel-raised`. Every control already read the token (`bg-ui-input`,
`var(--ui-input)`), so nothing per component changed. Light is unchanged: `--grey-2` already sits
under the white panel. Focus keeps the accent ring.

**Held by tests.** `greyscale-tokens.test.ts` requires the field darker than both panel surfaces
in both themes; `shell-render.test.ts` requires input, select, segmented track, filled button and
`FIELD_INPUT` to carry the token. DESIGN.md elevation rule rewritten.

**Discarded.** A second `--field` token: `--ui-field` already aliases `--ui-input`.
