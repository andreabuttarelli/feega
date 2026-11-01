# 0030 — Interaction states are a table on the element

Status: accepted 2026-10-30.

## Context

Users want Figma/Framer-style components in a simple mode: a "+" to add a variant, a state
switcher (Default, Hover, Pressed) and, on any element, per-state overrides that animate with a
curve when the pointer hovers it in the prototype and the web export. Components already exist
(`component.set` + `component.variant` in `src/lib/motion/variants.ts`); prototype links already
carry triggers and a transition with easing and duration
(`packages/motion-core/src/motion/prototype/model.ts`).

## How Figma and Framer model it

| | Figma | Framer | Feega |
|---|---|---|---|
| Container of variants | Component set (dashed purple frame) | Component with variants | Component set (`component.set`) |
| Add a variant | "+" just below the selected component set; a second "+" next to Add property creates a variant property | Add a variant from the component's variant bar | "+" below the selected instance → `appendVariant` (first property, default name `Variant`, values `Variant N` as Figma) |
| State naming | Variant property, convention `State=Default/Hover/Pressed` | Built-in Hover and Pressed variants, plus custom ones | Built-in `default`, `hover`, `pressed`, `focus` rows on the element |
| Where the state lives | A whole variant (copy of the component) | A variant of the component (override layer props) | A row of overrides on the element itself — no copy |
| Triggering | Interactive components: "On click" / "On hover" + Change to (variant). Prototype "While hovering" / "While pressing" go back on leave/release. A prototype interaction with the same trigger overrides the variant one. Components remember their last variant unless reset | Hover and Press states branch from one variant and carry their interaction automatically | Automatic in the prototype player and export: pointer enter/leave, down/up, focus |
| Transition | Smart Animate + easing preset or custom bezier/spring + duration | Spring or tween per transition (Motion: physical props default to spring) | `transition: { easing, durationMs }` per row; easing is a house ease id or a custom bezier, edited with the existing curve picker |
| Overridable | Every visual property | Every visual property | `STATE_OVERRIDES`: opacity, scale, rotateZ, blur, fill, stroke, strokeWidth, cornerRadius |
| Any element, not only components | No (needs a component) | No (needs a component) | Yes: text, shape, frame, image |

Sources read 2026-10-30: help.figma.com "Create and use variants" (360056440594), "Create
interactive components" (360061175334), "Prototype triggers" (360040035834);
framer.com/learn/component-variants; framer.com/motion/transition and /gestures.

## Decision

1. **States are data on the element**: `clip.states`, one row per state
   (`stateRowSchema`: `state`, `overrides`, `transition`). No row for `default` — the element as
   drawn is the default. One registry, `STATE_OVERRIDES`, says for every overridable key where it
   lands (transform or props) and how it is validated; a new property is a row there.
2. **Resolution is one pure function**, `resolveState(clip, state)`, shared by canvas preview,
   prototype player and export.
3. **Component variants stay what they are** (`component.set`/`variant`): the "+" button calls
   `addVariant`; built-in states are element rows, so a component and its instances get them
   without a variant per state. This is Framer's built-in Hover/Pressed rather than Figma's
   variant-per-state, chosen because it works on every element and doubles nothing.
4. **Agent parity**: `set_element_state` / `remove_element_state` motion tools, which the `edit`
   catalogue exposes to MCP.
5. **Optimistic without a REGISTRY row.** `REGISTRY` runs canvas rows (nodes, edges). `states`
   is a field inside a frame document, edited through `FrameEditSession.apply`, which already
   changes local state in the same frame and saves in the background with undo. A second path
   would mean two writers for one document.
6. **Preview is view state, never saved.** The inspector switcher writes `statePreview`
   (per frame, per clip); the canvas draws `previewDoc(doc, picks)`. The prototype player
   tweens the same picks with `amountAt` and `mixState`.

## Discarded

- Figma's variant-per-state: a hover on a single button would copy the whole component.
- Spring transitions: the house eases cover the cases; a spring is a new row in the ease table
  when needed.
