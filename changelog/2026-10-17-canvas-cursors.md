# Canvas cursors and live selections

Before, the canvas showed who was there (avatars) but not where they
pointed or what they selected; only the frame editor had cursors.

`canvasHub` (`src/lib/realtime/canvas-presence.ts`) sends one mark per
50 ms tick (20 Hz) only when cursor or selection changed, plus a 3 s
heartbeat; 10 s without a mark hides the peer. It rides the existing
`canvas:` channel as broadcast event `canvas-peer`, zero DB.
`connectCanvas` now carries broadcast lines from a table (frame,
canvas-peer) instead of one hardcoded event.

Marks are keyed by a per-tab `sessionId`, not `userId`: two tabs of the
same person see each other, as in Figma, which also makes the two-tab
real-stack test possible on production with the test account.

`PeerLayer.svelte` draws cursors and selection outlines in flow
coordinates, counter-scaled by zoom. `CanvasPeers.svelte` mounts it in
SvelteFlow's front `ViewportPortal`; GpuFlow mounts the same layer in its
viewport div once it lands.

e2e `canvas-cursors.spec.ts` (@real, test account): the cursor reached
the other tab 163 ms after the first pointer move and disappears when the
tab closes.
