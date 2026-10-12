# Prompt input motion template

First hand-made premium template: `builtin:prompt-input`.

## What

- A deterministic custom component (`PromptInput`, `src/lib/motion/template/prompt-input/`):
  placeholder, caret, human-rhythm typing with an optional typo and backspace, chips, send
  button pressed by a cursor, then thinking / clear / hold. Built-in camera: 2.4× on the text
  line following a smoothed caret path, expo move to the send button at 3×, pull-out, loop.
  Everything is a pure function of `t`; the camera averages measured caret positions over a
  trailing window so it never steps per keystroke or on a line wrap.
- 30 typed template fields grouped Text / Style / Motion (new optional `group` on fields;
  `FieldForm` shows group headers, sliders for ranged numbers, a value next to colours).
- Runtime variables: a component prop `varPrefix` makes the runtime read `<prefix>_<prop>`
  from `input.vars`, also for seeked (deterministic) runs, which now follow host updates.
  Insertion copies the template's declared vars; a second instance gets `prompt2`.
  `setTemplateValues` keeps the var defaults equal to the fields.
- Sounds: `templateCues` (server) derives key/click times from the same model; inserting lays
  them as SFX clips (editor action `templateSounds`, chat tool, API).
- Chat tool `insert_template` became `add_template({id, at, vars, sound})`.
- API `GET /api/v1/motion/templates`, `POST /api/v1/motion/{node}/templates`; MCP
  `list_motion_templates`, `add_motion_template`; CLI `feega motion templates`,
  `feega motion add-template`.

## Decisions

- One custom component, not a precomp of primitives: the typing, camera and caret need
  per-frame code; a component is copied into the project and editable as code.
- Inserted instances stay locked like every template (fields first, Detach to restructure).
- Limits raised: component props 30 → 40, fields per video 50 → 120 (two instances fit).
- Discarded: binding vars through `interactive.bindings` (nested comp clips are not reachable
  there) and computing sound cues on the client (would need eval under the editor CSP).
