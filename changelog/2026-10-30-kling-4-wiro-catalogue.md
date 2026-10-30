# Kling 4.0 and the Wiro menu

## Why Kling 4.0 was missing

The sync runs (6-hourly cron, last write 2026-10-30 06:00, all providers fresh). Wiro already had
`kling-v4` and `kling-v4-reference`. Kie publishes Kling 4.0 only as `keyframe-to-video` and
`reference-to-video`; `NEEDS_INPUT_MEDIA` in `kie-docs.ts` dropped any model with `reference-to`
or `keyframe-to` in its name, although both docs require only `prompt`. Both are now discovered
and priced from Kie's pricing page. Models that truly need media are still caught by their
required fields.

## Wiro hidden in standard projects

`project-mode.ts` mapped every `wiro/` id (except three reviewed 3D models) to the
`WiroModels` capability, allowed only in uncensored projects. The rule is now one: the
`uncensored` flag of the row. Run-time guard: `generationRefusal` refuses a flagged model in a
standard project, since the id alone no longer says so. Rows with `unrunnable` (three image
models with a required field without default) stay hidden.

## Hot models

Kling 3.0 replaced by Kling 4.0 (`wiro/klingai/kling-v4`).
