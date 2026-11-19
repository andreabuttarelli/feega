# 13 — Figma images

`POST /api/v1/projects/:projectId/figma-images`

Fetches the images of a Figma paste through the caller's Figma account connected with Composio, stores each
one as a project asset, and answers which asset each image became. Used by the canvas after a
Figma paste; there is no CLI command or MCP tool for it, because an agent has no Figma clipboard.

Auth: session or Bearer (JWT / `feega_` key), like every `/projects/:id` route.

## Request

```json
{ "fileKey": "PwswsA9kgYS8mkYzLjp2nq", "hashes": ["ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12"] }
```

- `fileKey`: from the clipboard `(figmeta)` block.
- `hashes`: image hashes (hex) of the paste, 1 to 40.

## Response

`200` `{ "assets": { "<hash>": "<assetId>" } }`. An image Figma does not serve, or one over 4 MB, is
left out of the map; the caller keeps its placeholder.

| Status | `error` | Meaning |
|---|---|---|
| 400 | `invalid` | Body is not a file key and 1 to 40 hex hashes |
| 409 | `no_token` | Figma is not connected (Settings, Profile, Connections) |
| 422 | `token_rejected` | Figma refused the connected account |
| 429 | `rate_limited` | More than 12 requests a minute for the user |
| 502 | `unavailable` | Figma unreachable or failing |

Calls go through the Composio proxy; Feega holds no Figma token.
