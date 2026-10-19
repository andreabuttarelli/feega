# One right bar, never remounted

**Why.** Canvas and motion editor each mounted their own `ChatPanel` (plus `{#if open}` and
`{#if tab}` around it): opening a frame, toggling the panel or the phone sheet threw the view
away — scroll, attachments, expanded items — and reloaded the thread. The session already lived
in a module store, so the stream survived; the view did not.

**What.** `RightBar.svelte` is mounted once in `/p/[projectId]/+layout.svelte` and parked
offscreen. Surfaces claim it with `BarSlot.svelte` (canvas pane, mobile chat view, editor chat
column/sheet); the last claim wins (`right-bar-host.svelte.ts`), and the bar's DOM node moves
there (`moveBefore` when available) with scroll offsets restored, also when a hidden sheet opens.
Context, turn-end, data and busy callbacks come from the active claim as data, not via remount.
Chat, Guide and Properties are tabs of that bar, hidden not unmounted. On a desktop editor the
Properties aside renders into the bar's Properties pane instead of a second segmented column;
`layout.side` still drives which tab shows.

**Discarded.** A shared store of view state (scroll, uploads, expanded items) re-applied on each
mount: many fields to keep in sync. Moving one DOM node keeps everything by construction.

**Tests.** `right-bar-host.test.ts`; e2e `right-bar-persists.spec.ts` (mocked stream, desktop +
phone), red on dev, green here. `motion-editor.spec.ts` ⌥⌘B now checks the Properties tab is
selected (the Agent aside contains the bar). `properties-panel.spec.ts:38` and
`frame-edit-patch.spec.ts` fail the same way on dev.
