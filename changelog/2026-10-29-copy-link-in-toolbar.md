# Copy link moves into the selection toolbar

The floating "Copy link to selection" pill above the toolbar was
intrusive. It is now the `copy-link` action (group `fixed`) in
`selection-actions.ts`: a link icon in the toolbar actions group, and
the first row of the `…` menu.

- `toolbarSlots` returns `fixed`; fixed actions also lead the overflow.
- `GpuFlow` runs it through `onCopyLink`; the page passes it unless
  `LocalOff.PublicLinks` is set, which withholds the action.
- Dropped: the transient "Link copied" label.
