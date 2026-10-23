# Figma paste: images through a personal access token

Pasting from Figma carried no images: the clipboard holds only each image's hash and the file key.
The decoder (#1190) drew a grey placeholder. The Figma REST API turns hash into URL
(`GET /v1/files/:key/images`) but needs the user's own token, so the token is the user's
setting, not the org's.

Pieces, in order of the path a paste takes:
- Paste lands synchronously, as before, with or without a token. Nothing waits on the token or Figma.
- `figma-doc.ts` now remembers which clip waits for which hash (`images`) and the `fileKey`.
- After the commit, `GpuFlow.svelte` (`fillFigmaImages`) asks `POST /api/v1/projects/:id/figma-images`
  (`src/routes/api/v1/projects/[projectId]/figma-images/`), then `imagesFilled` (`images.ts`) swaps the
  placeholders for image fills in one undoable step. Canvas-level paste hands the same job to GpuFlow
  through `figmaJobs`; in-frame paste calls it directly.
- The endpoint reads the sealed token (`src/lib/server/figma/token-store.ts`, `secrets/seal.ts`),
  calls Figma, downloads each image through `importCanvasLink` (https only, 4 MB cap) and answers hash
  to asset id. 40 hashes and 12 requests a minute per user at most.
- Without a token the endpoint answers 409 `no_token` and the page shows "Add a Figma token in
  Settings to import images" with a link, next to the existing skipped list.
- Settings, Profile: password field, Save, Test (`GET /v1/me`), Remove. Form actions in
  `settings/figma-actions.ts`, mirrored by the settings API.

Decisions:
- Sealed with `APP_SECRET` (the asset-grant scheme, extracted as `sealSecret`) rather than a database
  extension: no key management beyond what exists. The table `user_figma_tokens` is not applied by
  these PRs; every reader treats a missing table as "no token", so paste works unchanged until then.
- The GPU display list gained image fills on shapes (picture drawn through the shape as a stencil,
  the way text with an image fill already is). Before, any shape with an image fill made the whole
  frame fall back and render black.
- No CLI command or MCP tool: an agent has no Figma clipboard. Documented in `docs/api/13-figma-images.md`.

Discarded: applying the swap on the server (would race the client's own save of the frame);
storing the token in `app_accounts`-style plaintext.
