# Import from URL: component instances drawn right, exclusions lifted

Follows `2026-10-29-url-import-components.md`, which excluded cases to dodge renderer defects.

- Nested group not drawn (Linear "Reviews" icon): `flattenComps` stopped at `MAX_COMP_DEPTH` 8; an
  imported page nests deeper. Dev raised it to 24 in parallel; that covers the fixtures. Plain imports
  gained the leaves they lost the same way.
- Text shifted sideways in instances under auto layout: overrides were applied after layout. An
  instance with overrides is now laid out again (`instanceTracks` in `layout/resolve.ts`).
- A group holding an instance, in a flow, was measured as the whole frame (`compBounds` read a
  precomp's missing box). It now measures what the precomp shows, at its offset.
- That exposed the opposite case: a DOM block wider than what it draws. A frame without auto layout
  inside a flow, and every component frame, now keeps its box as an invisible background shape.
- Differences inside nested groups become path overrides (`nested-overrides.ts`, landed on dev in
  parallel) for any prop, not only text. `autoLayout` and `layoutItem` are overridable.
- Linking: the scene links an instance that draws its own layers even when its size differs; the diff
  accepts any difference on paired clips; per-instance image slots re-enabled on top-level clips
  (an image inside a nested group still unlinks the copy). `repeatedOf` no longer
  splits copies by size and no longer excludes auto layout.
- Components panel: previews were placeholders because the main of an imported component is nested in
  groups and `previewDoc` only looked on top-level tracks. It now hosts the component itself.
- Fixtures, mains / linked instances, before → after: linear 5/11 → 23/49, stripe 5/1 → 19/28,
  vercel 1/1 → 6/9. Fidelity: linear 0.7706 → 0.7946, stripe 0.5937 → 0.5978, vercel 0.9054 → 0.9065.
- Not done: picking a nested main from the Components panel (`mainClipOf`) still finds only top-level
  mains.
