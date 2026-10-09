# Hosted embeds: assets by URL, not inlined

`/e/<id>` served the stored bundle as is: ~10 MB per embed, every image and track base64-inlined
(Saturn: 49 data URIs, 29 distinct — the same 500 KB track repeated). Phones on slow networks
waited ~30 s for the first frame.

- `hostAssets` (`embed-assets.ts`) rewrites, at serve time, every data URI ≥ 2 KB into
  `/e/<id>/a/<sha256-16>`. Saturn page: 10.4 MB → 284 KB.
- `/e/[id]/a/[hash]` decodes the asset from the stored page: immutable year-long cache (CDN does
  the rest), `access-control-allow-origin: *` (the player's sandbox is an opaque origin and
  `freezeMasks` fetches), byte ranges (Safari media).
- Works for every embed already published, no republish, no migration: the stored file stays the
  self-contained bundle, which is also what the download keeps.
- Loader: `loading="lazy"` on the iframe, one `preconnect` to the feega origin.
- Discarded: uploading assets to the `embeds` bucket at publish — needs a migration (bucket allows
  only `text/html`, policy only `<uuid>.html`) and leaves old embeds heavy.
- Known cost: a cold asset request fetches the whole stored page from Storage once; range
  requests (206) are not CDN-cached.
- Libraries from our origin: PR #313, not duplicated here.
