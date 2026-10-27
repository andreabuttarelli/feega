# Figma import by link

Figma paste only carried what was on the clipboard. A frame in a file the user did not have open, or a whole page, had to be copied by hand.

`GET /v1/files/:key?depth=2` lists the top-level frames; `GET /v1/files/:key/nodes?ids=…&geometry=paths` gives the chosen ones. `rest-message.ts` turns the REST nodes into the `FigmaMessage` the paste mapper already consumes (vector paths are encoded into the same blob format), so there is one mapper: `planOf`, then `placeFigmaPlan` (extracted from `pasteFigmaAt`, behaviour unchanged). Image fills are fetched and stored server-side right after the frames are created, through the existing `importFigmaImages`.

Entry points: the add-bar tile and `FigmaImportDialog`, `POST /api/v1/projects/:id/figma/{frames,import}`, and the canvas ops `list_figma_frames` / `import_figma` (MCP `edit`). The dialog uses the REST routes, not a page action, so no parity row is needed.

Auth is the existing per-user personal access token (`user_figma_tokens`, sealed). Discarded: OAuth. It needs a Figma app registered for feega (client id and secret, redirect URI, token refresh storage); left as the next step, the token store and `FigmaOutcome.NoToken` are the seam.

Limits: 20 frames per import, 12 requests a minute per user. Instances come across flattened as in paste. Figma's REST API gives no style name for a font, so weight is derived from the numeric weight.
