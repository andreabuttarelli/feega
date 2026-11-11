# Frame sources in one request per canvas

Opening a canvas fetched `motion/[nodeId]/source` once per frame: ~10 serial
DB round trips each (session, memberships, canvas, reachability, node, head,
linked head, assets, projects, tokens), most identical across frames, and the
brand tokens repeated in every response.

`POST /p/[projectId]/c/[canvasId]/motion/sources` `{ ids }` authorizes once,
reads nodes and heads with one query each (`readHeads` on `docHeadRevision`),
the asset library and named assets once, tokens once. `frameSources` coalesces
the source URLs asked in the same tick per canvas into that request and adds
the tokens to each frame; a frame the batch leaves out (no head yet, stale
`docHeadRevision`) falls back to the single route, which stays for previews
and dialogs.

Not done here: per-frame immutable caching (needs tokens out of the frame
response), binary frame format. Compression: Vercel already serves function
responses with `content-encoding: br`.
