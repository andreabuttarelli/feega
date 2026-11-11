# Frame sources: signed links beside the frames, not inside them

The batched sources body put a two-hour signed Supabase URL in each frame's `assets`, so a frame
could not be kept by revision: its links expire. Each frame now carries the stable canvas
address (`/p/<p>/c/<c>/assets/<id>`, or the original absolute URL), and the response carries one
`signed` map, asset id → signed URL. The page draws with the signed link (no extra redirect hop,
as before) and keeps the stable address in `addresses`, which is what a client cache stores.

Discarded: serving only the stable addresses (#1894). Each asset then took a redirect hop through
the app; images arrived ~0.4 s later on cold opens.
