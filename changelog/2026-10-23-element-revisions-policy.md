# Element nodes may write revisions

`motion_revisions_insert` only accepted nodes of type `motion`, so a user session could not
write the document of an `element` node (generated image drop, svg paste, seeded fixtures:
RLS 42501, no revision, no clip). The policy now accepts `motion` and `element`.

Found by `tests/e2e/canvas-element-node.spec.ts` against production. Migration
`20261023140000_element_revisions_policy.sql` must be applied by hand.

The drag-out e2e clicked the frame centre; it now clicks the clip, as
`canvas-frame-free-children.spec.ts` does.
