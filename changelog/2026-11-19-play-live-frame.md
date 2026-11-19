# Play on a live frame shows the real page

Before: a live frame had no way into Play. `playerFrames` only held frames with a motion doc, so
`prototypePlayer.editing` stayed null on a live frame, and the header Play badge is drawn only on
core frames.

Now:

- `play-target.ts` decides by frame kind in one place (`playKindOf`): live → `LivePagePlayer`,
  drawn → `PrototypePlayer` as before. `PrototypePlayerHost` renders whichever it returns.
- `LivePagePlayer` shows the dev-server page at the play width: device widths, typed width,
  Restart (remount = reload), Full screen, Close. Dev server down → poster + Start dev server
  (`devServerAction('start')`).
- Entry point: a Play button on the selected live frame (`LiveFrameNode`).
- Desktop: `<webview>` instead of an iframe (`pageHostOf` on the shell user agent), so the page is
  a top-level guest: no X-Frame-Options or cookie partitioning issues; Open devtools calls the
  webview's `openDevTools`. `apps/desktop/guest-page.cjs` hardens every guest on
  `will-attach-webview`: preload stripped, no node, context isolation, sandbox, localhost only.
  `webviewTag` is on for the main window only.

Discarded: reusing `PrototypePlayer` with a fake doc — its viewport, breakpoints and hotspots are
all doc-driven; a small separate player is less code than special cases in it. WebContentsView:
needs main-process placement synced with the DOM layout over IPC; `<webview>` gets the same
isolation without that.
