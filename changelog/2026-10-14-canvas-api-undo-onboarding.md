# undo, demo_run and onboarding_end have an /api/v1 op

Step 1 of moving the canvas page actions to `/api/v1` (ADR 0009, option d). The three were
marked ui-only in the parity table, so a static build had no way to call them.

`parseUndoItem` moved verbatim from the page to `canvas/undo-plan.ts`. `undo_gesture` parses and
calls `undoGesture`; `run_demo` calls `runDemo`; `end_onboarding` calls `endOnboarding` — the
same functions the form actions call. A refused undo answers `{ outcome: 'refused', reason }`
(the action answers 409 with the reason). Client unchanged.
