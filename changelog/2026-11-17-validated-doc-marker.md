# Saved frames open without being parsed again

Opening a canvas read every frame's doc from `motion_revisions` and ran `parseMotionDoc`
(`upgradeDoc` + zod with ~30 defaults/transforms + clone) on it: ~80 ms per large frame, on every
cold read. Hosted lambdas are short-lived, so the in-process `PARSED_KEPT` cache rarely helped:
36 frames cost ~4–5 s of CPU.

`appendRevision` already validates every doc it writes. It now stores the validated doc with a
`$seal` field (`sealed-doc.ts`): an HMAC, keyed by `APP_SECRET`, over the doc text and the
**stamp** of the parser. `headOf` returns a sealed doc as stored when the seal checks out, and
parses everything else as before (rows from older releases, seeds, scripts, other secrets,
another stamp, any edit after sealing).

- **Where the marker lives:** inside the doc JSON. No migration; zod strips the unknown key, so
  older releases and every raw reader ignore it. `.feega` files carry it too; a file from another
  machine (another secret) is just parsed.
- **Why signed:** members can write `motion_revisions` directly under RLS (insert, update, the
  `commit_motion_revision` RPC). A plain "validated" flag would let them skip validation for
  their teammates, e.g. the http/https check on prototype links.
- **Key order:** jsonb reorders keys (byte length, then bytes). The writer stores keys in that
  order so the reader can sign `JSON.stringify` of what it read, instead of a canonical walk
  (38 ms vs ~10 ms per doc). Any order it cannot reproduce falls back to the full parse.
- **The stamp is not a constant to remember:** `scripts/motion-doc-stamp.ts` bundles
  `parseMotionDoc` with esbuild (tree-shaken, comments stripped) and hashes the output, served as
  `virtual:motion-doc-stamp`. Any change to a schema, default, upgrade step or check — or a zod
  upgrade — changes the stamp, and every older seal stops being trusted.
- **No write-back on read:** a GET does not rewrite rows. `motion_revisions` is published to
  realtime with replica identity full, so re-sealing would broadcast two copies of a multi-MB doc
  per frame opened. Frames get sealed on their next edit.

Measured on the 36-frame stress canvas (local mode, production build, 36 sequential single-frame
`/motion/sources` cold reads, 3 fresh servers each): `heads` phase 2.8 s → 1.0 s total
(p50 53 → 19 ms), request p50 94 → 66 ms, total 4.86 → 3.39 s.

Considered: a column flag (needs a migration, same forgery problem); a hand-bumped version
constant guarded by a source-hash test (the parser's sources change several times a day, so it
would conflict on every parallel PR).
