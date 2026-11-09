# Local storage honours image sizes

Local mode (self-hosting, the perf benches) signed every storage URL
without the `transform` Supabase render applies, so a `?size=256` canvas
asset still downloaded the original. The bench could never show what
zoom tiers save. `createSignedUrl` now carries the transform in the
query and the local storage route resizes with sharp (fit inside, no
enlargement, webp at the preset quality), like Supabase render.
