## Unreleased

- Runtime variables: `FeegaMotion(vars: {...})` (only changes are sent on rebuild), `controller.setVars`, `onVarsChange`, and `ReadyInfo.vars`/`values` with the schema (protocol 1.1).
- Scroll stories pin the stage in the frame the page scrolls; the player no longer rebuilds per scroll frame.

## 0.1.0

- First release: `FeegaMotion` widget hosting the feega player, embed protocol v1.
