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
| Add a variant | "+" button below/right of the set; "Add variant" in properties | "+" next to the variant in the component canvas | "+" on the main component on canvas → `addVariant` |
| State naming | Variant property, convention `State=Default/Hover/Pressed` | Built-in Hover and Pressed variants, plus custom ones | Built-in `default`, `hover`, `pressed`, `focus` rows on the element |
| Where the state lives | A whole variant (copy of the component) | A variant of the component (override layer props) | A row of overrides on the element itself — no copy |
| Triggering | Interaction "While hovering" / "While pressing" → Change to variant | Automatic for Hover/Pressed variants; Interactions on other triggers | Automatic in prototype and export: pointer enter/leave, down/up, focus/blur |
| Transition | Smart Animate + easing preset or custom bezier/spring + duration | Transition per variant: Spring or Tween with curve and duration | `transition: { easing, durationMs }` per row, the house ease ids |
| Overridable | Every visual property | Every visual property | `STATE_OVERRIDES`: opacity, scale, rotateZ, blur, fill, stroke, strokeWidth, cornerRadius |
| Any element, not only components | No (needs a component) | No (needs a component) | Yes: text, shape, frame, image |

Sources: help.figma.com "Create and use variants", "Create interactive components",
"Prototype triggers" (While hovering / While pressing), "Smart animate" and "Easing and spring
animations"; framer.com/learn "Variants", "Hover and pressed states", "Transitions".

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
5. Edits to `states` ride the frame document save that every clip edit already uses; the
   canvas `REGISTRY` is for canvas rows, not for fields inside a frame document.

## Discarded

- Figma's variant-per-state: a hover on a single button would copy the whole component.
- Spring transitions: the house eases cover the cases; a spring is a new row in the ease table
  when needed.
