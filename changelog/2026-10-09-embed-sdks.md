# Embed SDKs for React and Flutter, on one protocol

A motion embed only lived in web pages (`/embed.js` + `<feega-motion>`). Apps had to frame
`/e/<id>` by hand and got no scroll, no callbacks, no links.

- Protocol v1 written down in `docs/embed-protocol.md`, constants in
  `src/lib/motion/interactive/protocol.ts`. Host → player grew `command` (play/pause/seek),
  `time`, `fit`, `links`, `reducedMotion`, `pointer`, `tilt` (`readHost`). Player → host is new:
  `feega:player` with `size`, `ready`, `timeupdate`, `ended`, `link`, `error`, sent to `parent`
  and to a native `FeegaHost` bridge. Served pages pick it up at once: `readEmbed` re-wraps every
  stored page with the current player.
- Links: the player accepts `feega:link` only from its own composition frame, http(s) only; it
  opens them itself unless a host claimed them. No composition emits it yet.
- `packages/feega-motion-react` (`@feega/motion-react`): `<FeegaMotion>` frames the same player,
  builds the scroll story for scrub videos from `/e/<id>.json` like the loader, posts progress
  from the page or a scroll container. Zero deps, ESM + CJS + types, `'use client'`.
- `packages/feega_motion_flutter` (`feega_motion`): WebView + JS channel on the same protocol;
  progress computed in Dart; tilt from `sensors_plus` on Android/iOS only (no macOS plugin: it
  crashed the example); pause off-screen and in background, never before `ready` (a `play` sent
  with the playback still unknown would start a scrub video).
- Export dialog and `publish_motion_embed`/`get_motion_embed` (API, CLI, MCP) return `react` and
  `flutter` snippets next to `snippet`.
- `protocol.test.ts` fails when either SDK drifts from the player's names.
- Discarded: reimplementing the player natively (the experience would diverge); offline bundle
  (pages load runtime and assets by URL, a saved page alone would not play) — documented as next.
- Default `origin` in both SDKs is `https://feega.app`, which does not serve `/e` today; the
  generated snippets always pass the real origin.
