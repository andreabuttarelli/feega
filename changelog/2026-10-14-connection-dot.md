# Realtime connection: a status dot, backoff, resync

Production showed "Connessione in tempo reale interrotta" as a sticky `failed` banner: Italian,
never cleared, set by `connectCanvas`'s `onError` on any channel error. `CHANNEL_ERROR` was not
even reopened — only `CLOSED`/`TIMED_OUT` were, immediately and without backoff.

`src/lib/realtime/connection-link.ts` is now the one model: states `connecting | connected |
reconnecting | offline`, fed by channel statuses, `online`/`offline` and tab visibility.
Failures reopen after exponential backoff with jitter (1 s doubling, cap 30 s, delay in
[step/2, step]); `online` and a visible tab retry at once; every `SUBSCRIBED` calls the resync
port, which is the existing `checkStale(Trigger.Reconnect)` → revision → `refresh()` snapshot
path. `LINK_DOT` is the state → tone/tooltip table; tones are `--link-live/-pending/-down`
in `app.css` (aliases of `--ui-ok/-warn/-danger`, so dark mode follows).

The page publishes the state through the `canvasLink` store; `CanvasTopBar` and
`MobileTopBar` render `ConnectionDot` (8 px circle). Saves are untouched: the save scheduler
keeps retrying offline as before.

Also translated to English: the canvas page's remaining Italian notices (undo, connect, loop,
conflict, workflow chip, peers label) and every error string of the canvas form actions in
`c/[canvasId]/+page.server.ts`, which reach the banner through `saveMessage`.

Not translated, deliberately: model-facing Italian prompts in `src/lib/server/` (agent-team,
hook-tactics, brand-guardrails, disruptive, production-ladder, prompt-enhance) — they are
instructions to the model, not UI. Worth a separate pass if they leak into replies.

Tests: `connection-link.test.ts` (transitions, backoff schedule, resync), `canvas-channel.test.ts`
(error/close/timeout reopen after backoff, offline/online), `connection-dot-render.test.ts`, and
the `@real` e2e in `canvas.spec.ts` (setOffline → offline dot → admin edits the node → online →
connected and the edit shows).
