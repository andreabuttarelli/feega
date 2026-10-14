# Canvas open: no catalogue signing, memoised asset redirects

**Before.** Every canvas load (`/p/.../c/...` and `/app/studio`) called `referenceLibrary` →
`listCatalogueImages`, which signed every reference-catalogue image with a transform: one
`createSignedUrl` per image (33 today), because `createSignedUrls` takes no transform. During DB
stalls each took 2–9 s. Every poster/image tile went through `/p/.../assets/<id>`, which read
memberships, canvas, reachability and the asset row (4 queries) before signing.

**Now.**
- The catalogue carries lazy URLs `/reference-images/<path>?preset=<preset>`. The new route
  signs one image when the browser actually asks for it (picker open, picked thumbnail), reuses
  the in-memory minted-URL cache in `media-thumbnails.ts`, and answers a private 302 cached for
  half the signature TTL.
- The asset route keeps the signed redirect in memory per user+canvas+asset+size
  (`asset-redirects.ts`) for `CANVAS_REDIRECT_MAX_AGE_S` — the same window the browser already
  caches the 302 for, so no access outlives what was already granted. A hit does no DB read and
  no signing. Both paths report `Server-Timing`.

**Measured** (test account, production storage, 33 catalogue images): before 33 sign requests
on open, ~670 ms wall in parallel on a healthy DB; after 0 on open, one ~90–170 ms sign per tile
actually shown.

**Discarded.** A public CDN bucket for the catalogue: needs a migration and moving objects for a
gain the lazy route already gives. Signed URLs stored in node data: they expire and would need a
writer to refresh them.
