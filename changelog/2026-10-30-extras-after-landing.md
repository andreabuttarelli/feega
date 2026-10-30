# A frame shown before its save asks for its editor data after the save

Since duplicates and drawn frames show before the server writes them, selecting the copy built its
`FrameExtras` at once and `load()` fetched `/api/v1/.../motion/<id>` for a row that did not exist
yet: 404, an unhandled `HttpError` in the console, and the rejected promise stayed cached — media
and font uploads into that copy failed until a reload.

`FrameExtras` now takes the node's landing promise (`drawSaves` in GpuFlow, resolved `true` for a
node already saved) and loads only after it resolves `true`; a refused copy never asks. Found in
the pre-release browser sweep of 2026-10-30.
