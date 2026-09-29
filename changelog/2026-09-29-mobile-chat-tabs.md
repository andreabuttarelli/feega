# Mobile chat keeps running across tabs

Before: `ChatPanel` held messages, stream and abort in component state, under `{#if}` on
mobile (`mobileView === 'chat'`), on desktop (`open`) and behind the Guide tab. Switching
away unmounted it; the fetch kept reading into a dead component and the remount loaded
history without the in-flight turn: the chat looked stopped. Observed on origin/main at
390×844: back on Chat mid-turn, no agent message, no stop button.

Server: the model stream was consumed only by the response. A client disconnect (reload,
close) cancelled it and `onFinish` never saved the turn. Reproduced in
`agent/server.test.ts` (cancel after the first chunk: assistant turn never saved).

- `chat-session.svelte.ts`: one `ChatSession` per endpoint, module scoped; the panel only
  renders it. Rejected keeping the panel mounted with CSS: it would not cover desktop close,
  the Guide tab or a viewport change.
- `+server.ts`: `void result.consumeStream()` so the turn finishes and is persisted.
- `canvas-reveal.ts`: the canvas refetches its snapshot when the Canvas tab is tapped and on
  `visibilitychange` to visible, on top of realtime (which stays subscribed while hidden).
  Nodes appeared live in desktop Chrome at 390×844 before the fix too; the refetch covers a
  socket dropped while the page was in the background.
- `chat-leave-guard.ts` + `ChatLeaveGuard.svelte`: while a turn runs, leaving for another
  project page, another project or outside asks "Leave anyway?" (app dialog); canvases of
  the same project and same-page navigations pass; tab close/reload uses `beforeunload`.
  The mobile Calendar tab no longer flips the view before the navigation, so "Stay" keeps
  the chat on screen.
