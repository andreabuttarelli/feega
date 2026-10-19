# Properties tab: one inspector, not one per editor opened

Since the single right bar (#831), `SideColumn` portals its Properties pane into
`rightBar.propertiesPane` with a `use:` action that only appended. Svelte removes a block's
top-level nodes when it tears down; a node moved into another parent is not one of them, so each
closed editor left its inspector in the bar. The pane stacked one "Frame" section set per editor
opened, and clicks reached a stale one bound to a closed frame.

`portalInto` (in `right-bar-host.svelte.ts`) now returns `destroy`, which removes the node.
Unit test in `right-bar-host.test.ts`; real-stack e2e `right-bar-one-inspector.spec.ts` opens
frame A, closes it, opens B, asserts one inspector and that a width edit lands on B only.
