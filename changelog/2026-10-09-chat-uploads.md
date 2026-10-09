# Chat uploads: files and images in the canvas and motion chats

**Why.** Both agent chats took text only. A brief, a deck or a logo had to be pasted by hand or
dropped on the canvas first.

**Path.** Composer (paperclip `IconButton`, drag & drop, paste) → `ChatUploads`
(`chat-uploads.svelte.ts`) → `POST /api/v1/projects/[id]/attachments/sign` (signed upload URL in
`canvas-assets/<org>/<project>/chat/<uuid>__<name>`) → browser `PUT` with progress →
`POST /api/v1/projects/[id]/attachments` → `registerAttachment` (download, convert or screen,
`assets` row) → asset id on the chip → agent POST `attachments: [assetId]` → `askedAttachments`
(org + project scoped) → `saveTurn` writes `chat_messages.attachments` → `userContent` builds the
model message: documents as `### Attached file: <name>` text parts, images resized to 1568 px as
image parts plus their asset id and a placement hint (canvas: `create_node` image data; motion:
asset id). History carries `[Attached: …]` with asset ids.

**Decisions.**
- Bytes never cross a function body: the signed upload URL skips Vercel's ~4.5 MB limit and gives
  real progress through XHR.
- Conversion reuses `convertFileToMarkdown` (markitdown-ts, unpdf, turndown); PPTX is new, read
  with `fflate` (already a dependency) from `ppt/slides/slideN.xml`. Text capped at 60 000 chars
  with a truncation note.
- Limits: 20 MB per file, 10 per message, allow-list in `$lib/chat-attachments.ts`, shared by
  client and server.
- Images go through `screenModelReferences` like generation references: the people check runs in
  uncensored projects; a refused file is deleted and the chip shows the reason.
- Attachments are ordinary project assets, so the motion agent sees them in its asset list and
  the canvas agent can place them.
- MCP/CLI: `ask_motion_agent` and `feega motion ask --attach` take `url`, `asset_id` or inline
  base64 `data` (≤ 4 MB) — resolved server-side by `resolveSources`.
- `chat_messages.attachments` moved from free-form to a validated jsonb schema. No migration: the
  column exists and has no check constraint.

**Discarded.** Multipart through the agent route (body limit); a separate upload table (assets
already model it).
