# A feed outputs its videos

**Before:** a `social_account_feed` had one `images` port. Its videos never reached a
generation node, and video slides kept only the raw CDN url, which expires.

**Now:**
- `DEFAULT_FIELDS` (`select-sources.ts`) gives the feed a `videos` field (`video`), next to
  `images` (`media`, stills only). `select-outputs.ts::sourceOutputs` turns every media port
  in that row into a named output (`out:images`, `out:videos`), the same pattern as the audio
  node; a source with one media port (products) keeps its plain port.
- Server: `upstream.ts` attaches `sourceOutputValues` to the fixed feed wire, so `out:videos`
  flows through `throughPort` to `referenceVideoUrls`, capped by `videoRefCapacity`. A model
  without video input rejects it in `resolveUpstreamInputs`; the canvas refuses the edge up
  front (`canConnect` with the handle's medium). A null-handle edge drawn before keeps
  giving stills.
- Sync archives each video slide's file (`archiveVideoToBucket`, 50 MB / 60 s cap) to
  `canvas-assets` as `videoPath`; `listNodeSocialPosts` signs it into `url`.
- Video references already go through `screenRunReferences` (video medium).

**Left as is:** feeds synced before this change have no `videoPath` and keep CDN urls until
they are synced again. A video over 50 MB is not archived and falls back to its CDN url.
