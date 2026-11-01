# Go to main selects the main, and zooms to it

"Go to main component" on an imported instance seemed to do nothing:
the main's home is the set frame on the Components page; the canvas
focused the whole set frame (often far from the view) and, when the
main sat inside a group, selected the group (`mainClipOf` returned the
outer clip, #1629).

- `mainClipOf` returns the scene id of the main itself
  (`group__0__main`), so the selection lands on it.
- After the pick, the camera zooms to the selection (`zoomToSelection`).

Not reproduced end to end: `tests/e2e/url-import-go-to-main.spec.ts`
(test account, imports vercel.com) was written but every run timed out
while the machine sat at load 190, dev modules taking 19 s each.
