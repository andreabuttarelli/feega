# Export code: nested instance overrides become props

An outer instance overriding a nested instance (Growth tier recolouring its Check item labels) lost the override: the inner component got only its own static values, so the dark card rendered grey-on-dark checklist text.

- `instances.ts`: hosts now include the effective nested instances of every host (`<host>/<nested>` ids, depth-capped by `MAX_COMP_DEPTH`), so the inner plan sees every value it must render. `expose` then lifts each inner prop that varies across outer hosts onto the outer component as `<nestedLayer><InnerProp>` (`feature1LabelColor`), with the nested master's own value as fallback, and records a forward.
- `UseNode.forwards` carries `inner={outer}`; React/Svelte write it as an attribute, HTML resolves it while expanding.
- Fixture: Ledgerline tier checklist is now a `Check item` component.

Discarded: deep-merging nested `overrides` in `withOverride` (engine behaviour, separate change).
