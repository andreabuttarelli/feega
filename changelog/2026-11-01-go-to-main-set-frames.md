# Go to main finds mains on the Components page

"Go to main component" on an imported instance still did nothing after
`2026-11-01-go-to-main-exact`. The instance's `home` is right (the set
frame on the Components page), but when the home is on another canvas
the page asks the project components list where that frame lives
(`mainNav.where` → `mainLocation`), and `listProjectComponents` only read
`motion` nodes. An import lays its sets on the Components page as free
`element` frames, so the list never held them and the request stopped
without moving the view.

`listProjectComponents` and `readComponentSource` now also read the
element frames of the project's Components page (`framesOf`). Not every
element node in the project: the motion list is capped at 200 by
`updated_at`, and on the test project 187 element frames on the
Components page alone would have pushed every other canvas out of it.

Verified end to end on the test account: import vercel.com through the
API, select a Logo instance in the layers panel, click Go to main: the
page opens the Components canvas with the Logo main selected, no console
errors (`~/Documents/feega-videos/url-import/in-app-2026-11-01/go-main-*.png`).
Before the fix the same import's homes were missing from the list.
