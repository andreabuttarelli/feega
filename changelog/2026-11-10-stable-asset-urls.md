# Frame sources carry stable asset addresses, not signed URLs

The batched sources body carried a two-hour signed Supabase URL per asset. That made the body
change every time a signature was re-minted, and so uncacheable by revision, and put a signing
round trip on the request path.

Assets in the batched body are now `/p/<project>/c/<canvas>/assets/<id>`, the route that already
redirects to a fresh signature (and that images already went through via tiered sizes). Absolute
original URLs stay as they are. The image size hints no longer depend on a signed URL.

The single-frame `.../source` route still signs: editor and export paths read it.
