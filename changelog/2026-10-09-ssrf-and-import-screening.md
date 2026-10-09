# Agent URLs through the SSRF guard, imported pictures screened

URL attachments (`ask_motion_agent`, MCP/CLI) were downloaded with a plain `fetch`: an agent could
point it at `169.254.169.254`, `localhost` or a public URL redirecting there, and the body landed
as a project asset. The motion agent's `import_asset` stored pictures with no moderation, while
chat uploads and `import_products` went through it.

- `importAttachment` → `safeFetchBytes` (public hosts only, every redirect hop re-checked, 20 s,
  `CHAT_ATTACHMENT_MAX_BYTES`). `AttachmentPorts.fetch` removed: tests stub the global fetch.
- `farmCapture` resolves the host before opening a sandbox (`assertPublicUrl`, https only).
  Redirects inside the farm browser are not gated: it runs in the farm sandbox, not our network.
- `analyzeBrand` site images: string-only `isUrlSafe` → `safeFetchBytes` (DNS-resolved check).
- `storeImage` screens the stored file (signed URL) with the upload screening; refused → file
  removed, no `assets` row. Covers `import_asset` urls, inline SVG logos and captures.
- Audited and left: provider result URLs (wiro, video jobs, render queue), signed storage URLs
  (studio zip, ui-read, apply-effects, brand-media), `download-post-media` (own media only),
  `knowledge.htmlFromUrl` (no route creates URL documents), site-analysis `fetchPage` (own
  per-hop guard). Residual: site-analysis `defaultEntryProbe` follows redirects blind (no body).
