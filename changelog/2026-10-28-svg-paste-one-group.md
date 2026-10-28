# SVG paste over a Frame lands as one group

`pasteSvg` drew one pen element per path and grouped them only on bare canvas. With the
cursor over a Frame it moved each path into the frame separately: loose, independent
elements. It now always groups first and then moves the group into the frame as one child
(`groupHolding` in `frame-holding.ts` decides from the union box; `regroup` takes an
`after` step so the move runs once the group exists on the server).

The Figma-clipboard path already lands an unfilled frame as one group
(`figma-doc.test.ts` guards it with several shapes).

Not verified in a browser: the local dev server returned 500 and the node build stalled.
