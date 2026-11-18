# Shared links and hosted embeds run in an opaque origin

The shared-link viewer (`/s/<token>`) rendered a node's embed URL with
`sandbox="allow-scripts allow-same-origin"`. An embed pointing at a page on the app's own origin
(`/e/<id>` serves HTML a member uploads through the embed upload slot; `/e/<id>/a/<hash>` serves
any type a page declares) then ran with the app's origin in the viewer's browser.

- The viewer now takes `IFRAME_SANDBOX` and `IFRAME_REFERRER_POLICY` from `iframe-node.ts`, as the
  canvas does. No `allow-same-origin`.
- `INERT_DOCUMENT_HEADERS` (`Content-Security-Policy: sandbox <IFRAME_SANDBOX>`, `nosniff`) is sent by
  every route serving user-authored documents: `/e/[id]`, `/e/[id]/a/[hash]`, the motion live page,
  `/components/preview`. They stay inert when opened top-level. Embedding via `embed.js` and the
  share frame page keeps working: scripts are allowed, the origin is opaque, and the assets already
  answer CORS.

Not done: refusing app-origin URLs in the node-data schema. With the sandbox they are inert, and
embedding one's own published `/e/<id>` is a legitimate use.
