# Runtime variables: the host page drives the embed

**Why.** Asked: the script and the React/Flutter embeds should take variables from the host's own
code (a value set in the editor drives something interactive) and change the visual live, without
reloading the webview.

**Before.** Live input was a fixed set (`input.pointer.*`, `tilt`, `scroll`, `time`), numeric only,
fed by the player. A host could not pass anything of its own.

**What.**

- Model: `interactive.vars` (number min/max, boolean, enum, color, string, each with a default) and
  `interactive.bindings` (string/color → Title/Text/Kicker/Caption text, colour, Caption
  background). `var-model.ts` is zod-free because the live chunk and the serialised player import
  it; zod lives in `var-schema.ts`; doc ops in `vars.ts`. One table per rule: `KINDS` (numeric
  projection, validation), `BINDABLE` (what a layer can show), `STARTER` (editor defaults).
- Expressions: `vars.<name>` on the existing `InputPort` (boolean 1/0, enum index). `readsInput`
  treats `vars.` as live, so a var-driven lane runs live and `liveInputProblem` refuses it on
  frozen props, as for `input.*`. Bakes read the defaults (`defaultInputs` in `bake.ts`);
  `composeHtml({ vars })` renders other values (`withVars` + `boundDoc`).
- Player: keeps current values (defaults first), `coerceVars` validates/clamps a partial host
  update (serialised into the page with `VAR_RULES`, so no enum references leak), sends `vars`
  with every input frame, echoes `vars`; `ready` carries schema and values. The composition
  (`runtime.ts`) feeds numbers to the live scene and paints text/colour bindings when values
  change; custom components get `input.vars`.
- Hosts: `<feega-motion vars='…'>` (watched attribute), `el.setVars`, `ready`/`vars-changed`
  events; React `vars` prop diffed with `changedVars`, `setVars`, `onVarsChange`; Flutter `vars`,
  `controller.setVars`, `onVarsChange`. Values set before the player listens are held until
  `size`. `protocol.test.ts` now checks `VarKind` in both SDKs.
- `/e/<id>.json` lists `vars`, so a host can build controls before the player loads.
- Editor: `VarsPanel` under Interactive preview — declare, preview (slider/toggle/select/colour/
  text, sent live to the preview), set default, bind to the selected layer. Agent: `declare_var`,
  `remove_var`, `bind_var`, `unbind_var` (MCP reaches them through `ask_motion_agent`).

**Discarded.** A separate message type for variables (the host message already merges partial
fields). Numbers for text/colour in expressions (the expression language is numeric). Binding
inside precomps: bindings target top-level layers only.

**Verified.** Plain HTML (`docs/examples/runtime-vars.html`) and React
(`packages/feega-motion-react/example/vars.html`) against a locally composed player: speed, spin,
label and tint change live, zero navigations of the iframe. Recordings in
`~/Documents/feega-videos/runtime-vars/`.
