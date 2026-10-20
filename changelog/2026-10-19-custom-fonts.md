# Custom fonts: an org library, not a per-video file

Before: the font picker could upload a file, but it landed as a project asset under
`<org>/<project>/`, its family came from the file name, every file was weight 400, and only the
video that uploaded it knew about it. Nothing listed, renamed or deleted it; the chat agent and
MCP could not see it.

Now an upload goes to `canvas-assets` under `<org>/fonts/` and becomes an `assets` row with
`project_id = null` (the org library), `type = 'document'`, `mime_type = font/<format>`, and
`content` holding `{family, weight, italic}` read from the file's `name` and `OS/2` tables
(`font-meta.ts`: TTF/OTF directly, WOFF via zlib, WOFF2 via brotli — name and OS/2 are never
transformed in WOFF2). Magic bytes and the 10MB cap stay the gate; a file whose names cannot be
read falls back to the file name. Files of one family group into `FontFamily.variants`; a doc's
`FontFace` carries `variants`, so each file is its own `@font-face` with weight and style.

`motionAssets`/`assetsById` add `listFontAssets` (org-wide, any project), so every render path
that signs assets — editor, previews, still/PNG/SVG/PDF export, farm render, embeds, agent
frames — gets the font URL without a change of its own. A deleted family leaves the doc's face
without a URL: `missingUploads` drives the editor warning, the CSS omits the face and the text
falls back.

Discarded: a migration adding a `font` asset type. `document` + font mime was already the
convention (`kindOf`), and `content` is free for metadata. RLS needs nothing new: editors write
assets and `canvas-assets/<org>/…`, viewers never reach the editor.

Editor ops `list_fonts`, `rename_font`, `delete_font` (and `upload_font`, now org-scoped) are the
same functions behind the editor actions and `/api/v1/motion/{node}/ops`; the canvas page gets
`uploadFont` for a font dropped there. The chat tools `list_fonts`, `set_font`, `register_font`
take uploaded families by name — no new tool names. Rename changes only the library name:
videos keep the family they registered and keep loading by asset id.
