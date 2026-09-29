# Serve thumbnails, not full images, in small tiles

Before: `NodeReferences.svelte`'s picker (both tabs), the Media → Global tab,
the project drag panel and the assets page grid all loaded full-size signed
images into tiles as small as 28-180px. A 2MB catalogue PNG rendered at
96x96px cost the same bytes as opening it full-screen.

## Supabase Storage image transformations

Signed URLs support a `transform` option (`width`/`height`/`resize`/
`quality`) that resizes server-side before the bytes leave storage. Verified
against the real project with a curl-equivalent test: a 2,029,399-byte PNG
signed with `{ width: 192, height: 192, resize: 'cover', quality: 70 }` came
back at 16,886 bytes — about 120x smaller.

`createSignedUrl` (singular) honors `transform`. `createSignedUrls` (the
batch call every signing helper already used) silently ignores it — verified
the same way: a batch-signed thumbnail request returned the full 2MB file,
no error. `signThumbnailUrls` (`src/lib/server/media-thumbnails.ts`) is the
one place that decides this: batch when no preset is given (unchanged
behavior, unchanged cost), one `createSignedUrl` call per path in parallel
when a preset asks for a thumbnail.

## One preset table

`ThumbnailPreset` (`pickerTile` `mediaGrid` `nodeThumbnail` `panelTile`) maps
to the tile's rendered px, doubled for device pixel ratio, at quality 70 —
one table in `media-thumbnails.ts` instead of a magic transform object
scattered at each call site.

## Wired

- `reference-images.ts::listCatalogueImages` — picker's Global tab
  (`pickerTile`) and the assets page Global tab (`mediaGrid`)
- `asset-storage.ts::signAssetFiles` / `media-archive.ts::signKnowledgePaths`
  / `sign-media.ts::signAssetPaths` — the shared signer every asset-facing
  route calls, now takes an optional preset
- Assets page grid (`mediaGrid`) and the project drag panel
  (`panelTile`) pass it through

Full-size signing is unchanged everywhere a full image is actually needed:
generation inputs, opening an asset via `/c/<canvasId>/assets/<id>`.

`loading="lazy"`, `decoding="async"` and explicit `width`/`height` added to
the `<img>` tags in the picker, the assets grid and `BrandLogo` to avoid
layout shift and defer offscreen decoding.

## Test

`media-thumbnails.test.ts` is written first: asserts the preset sizes and
that `signThumbnailUrls` batches without a preset but signs one path at a
time with `transform` when a preset is given — the exact split the batch
endpoint's silent no-op forced.

## CI break: `db.storage.from(...)` called on an empty path list

`signAssetFiles`/`signKnowledgePaths`/`signReferenceImages` used to check
`if (!clean.length) return out` BEFORE ever touching `db.storage` — the
refactor into `signThumbnailUrls` moved that check inside the shared
function, but every call site still built the bucket eagerly
(`db.storage.from(BUCKET)`) before calling it. `generate.test.ts`'s fake db
has no `.storage` at all — a run with nothing to sign (the common case:
`upstream.pickedImageUrls` empty) threw, caught by `runGenNode`'s
try/catch, and turned a `done` outcome into `refused`.

`asset-storage.test.ts` reproduces it first: a `db` whose `.storage` getter
throws, called with `paths: []`, must never touch it. Fixed by making
`signThumbnailUrls`'s first argument a bucket FACTORY (`() => SignedUrlBucket`)
instead of the already-built bucket — the empty check now runs before the
factory is ever invoked, in the one place that owns it, instead of
duplicated at each of the three call sites.
