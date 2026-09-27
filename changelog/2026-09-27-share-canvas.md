# Share a canvas by link

**Before:** the top bar had "Publish", opening the create-post sheet — a second door to what
the selection toolbar's "Create post" already does.

**Now:** "Share" opens a popover: toggle "Anyone with the link can view", copy the link,
"New link" rotates the token. Anyone with `/s/<token>` sees the canvas read-only, no login.

**Decisions**
- `canvases.share_token text unique null` + `shared_at` (migration
  `20260927160000_canvas_share_token.sql`, applied). Stored in clear, not hashed like doc
  links (`nodes.public_token_hash`): the owner must be able to copy the link again later, and
  org members can already read the canvas. Revoke = `null`; rotate = new token.
- Public read goes through a declared service-role use (`canvas-share.ts`): token → canvas →
  org_id read from the row → nodes (`deleted_at is null`), connections, assets; media signed
  at load. Output carries node content only: no org, project, prompt, user.
- Viewer reuses `CanvasFlow` with `mode={CanvasMode.View}`; `canvas-mode.ts` is the one table
  of SvelteFlow flags and chrome (keys, add bar, selection toolbar, next steps). Node bodies
  are a read-only renderer (image, video, text, doc, iframe); other types show an empty tile.
- Unknown/revoked token → 404, one branch.
- Not in CLI/MCP: no canvas-share equivalent exists there.

**Discarded:** reusing the editing node components (GenNode etc.) in the viewer — each carries
prompts, run buttons and writes.
