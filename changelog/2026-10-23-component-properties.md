# Component properties (CO-06, CO-07)

Instances could only override a layer by its inner id. Figma exposes a named property on the main
that every instance sets.

- Model: `component.properties[key] = { kind, target, default?, nested? }` on the main
  (`doc.ts` `propertyDefSchema`), values on the instance in `props.propValues`.
- Kinds: `boolean` (layer hidden when false), `text`, `swap` (nested instance gets another main),
  `nested` (exposes a property of a nested instance on the top instance; resolves recursively
  because the nested host receives `propValues` before it expands).
- Resolution: `property-resolve.ts` turns a value into an override; `overridden` in `precomp.ts`
  merges it under explicit overrides, so both renderers (GPU and Hyperframes) see it unchanged.
- Ops in `component-properties.ts`; MCP `component` actions `define-prop`, `remove-prop`,
  `set-prop`, `reset-prop-value`; `InstanceInspector.svelte` exposes per layer and edits per instance.
- Discarded: reusing the template field model, which is doc-level and not per instance.
- Not done: slots (CO-08); variant properties stay the existing set/variant matrix.
