# Auto layout sizing intent before parenting

`setLayoutItem` refused `fill` on a clip with no auto layout parent, so an
agent building a page had to wrap first and size after, one call per child.
The refusal is gone: `layoutItem` is only read for children of a container,
so on an unparented clip it is a stored intent that takes effect once the
clip is parented. `wrapInAutoLayout` no longer overwrites a text clip's
existing sizing with hug.

`add_auto_layout` takes `children: [{ clip_id, width, height, ... }]` in
place of `clip_ids`, sizing each child in the same call. A new container
aligns `start` instead of `center` on the cross axis: a page column reads
left-aligned by default.
