# Frame session reads only the assets it can use

`motionAssets` listed every asset of the project (897 rows, 669 KB on the heavy canvas copy,
mostly text documents with their `content`) and then kept the first 200 media in JS. It was the
slowest phase of the frame session request (~190 ms, critical path).

Now it asks `listProjectAssets` for media types with a url, and for `font/` documents, each with
`limit 200`, in parallel; merges newest first. Signing was already batched and cached per process,
so it was not the cost.

Measured on a prod build against production Supabase, warm: `assets` 179–238 → 100–116 ms,
session 252–317 → 203–231 ms. `head` (~140 ms) is now the critical path.
