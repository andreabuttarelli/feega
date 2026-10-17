# Dashboard navigation keeps the shell

Dashboard → Canvases blanked the whole screen with a full-page shimmer. Cause:
`entryShell` treated every navigation into `/app/*` as an entry into the app,
even when it started inside `/app`, so the root layout laid `AppEntryShimmer`
over the already-mounted `AppShell`.

- `entryShell` returns `None` when both ends are dashboard routes.
- `AppShell` shows a skeleton in the content slot only, after 150 ms.
- `/app/canvases` reads only projects, canvases and motion frames
  (`recentCanvasesFor`): no images, batches or video signing it never showed.

Measured: prod API for the page ~230 ms warm, ~2 s on a cold function. The
reported 6 s was not reproduced on the test account (~0.4 s); the full-page
shimmer was, in Chromium and WebKit. Test: `tests/e2e/dashboard-nav.spec.ts`
(also run in WebKit).
