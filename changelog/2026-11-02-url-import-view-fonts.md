# A font only a breakpoint view uses is registered in the imported frame

Importing the top of vercel.com with breakpoints (the default since `0b6cb8493`, and the
path a signup with a website takes) landed an empty 16:9 frame. The phone read sets
Geist Mono on text the desktop top does not have; `withViews` merged the phone clips into
the desktop doc but not the phone doc's `fonts`. `parseMotionDoc` refused the doc
(`font Geist Mono is not in this video`), `frameStore.create` dropped the refusal, and the
node stayed with no content.

`viewed` in `page-views.ts` now joins each view's fonts into the frame's, by family.

Found in the pre-release sweep: `extent: top` + breakpoints on vercel.com gave 0 clips on
dev and 92 on main (no breakpoints). Guard: the `page-views.test.ts` case on a phone-only
font.

Not changed here: `frameStore.create` still ignores an `Invalid` revision write, so any
other invalid plan doc lands as an empty frame with a 200.
