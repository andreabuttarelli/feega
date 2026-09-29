# Sign organic post media before handing it to Zernio

Before: `scheduleDelivery` (`repos/post-delivery.ts`) passed `assets.url`
straight into `SocialPublisher.publish`'s `mediaUrls`. `assets.url` is a
private storage path (`canvas-assets/<orgId>/...`), not a fetchable URL — any
real publish carrying media would have failed the moment Zernio tried to
download it. Existing tests didn't catch it: the fixture asset used an
already-absolute CDN URL.

The paid-ads path (`ads/provider-media.ts::providerMediaSigner`) already had
the right shape: check absolute vs. stored, sign the stored ones through
`signAssetPaths`. Reused it here instead of writing a second signer.

## TTL: scheduled publish, not an immediate read

`asset-storage.ts::signAssetFiles` defaulted to 300s — fine for the app
reading a file right now, wrong for Zernio, which fetches media at the
scheduled time and a scheduled post can sit for days. Signing at
schedule-time with a short TTL would go stale before Zernio ever calls it
back.

Decided: keep signing at schedule time (no new job, no upload-to-Zernio
step — the client has no media-upload endpoint, only `mediaItems:
[{type, url}]`), but with a TTL long enough to outlive any realistic
schedule window: `ZERNIO_FETCH_WINDOW_SECONDS = 30 days`
(`post-delivery.ts`). `signAssetFiles`/`signAssetPaths`/`providerMediaSigner`
now take an optional `ttlSeconds`, defaulting to the old short window so the
paid-ads call site (an immediate launch) is unaffected.

A post scheduled further than 30 days out is still a gap — not addressed
here; flagging it rather than guessing at a bigger number.

## Test

`post-delivery.test.ts` gained a case with a storage-path asset (not an
absolute URL) and asserts `publisher.publish` receives an `https://` URL,
never the raw path. Failed first (`expected 'org-1/...' to match /^https:/`)
before the fix.
