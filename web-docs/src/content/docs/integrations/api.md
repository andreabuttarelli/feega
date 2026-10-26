---
title: REST API
description: The /api/v1 endpoints the CLI and the MCP server call.
sidebar:
  order: 3
---

Everything the [CLI](/integrations/cli/) and the [MCP server](/integrations/mcp/) do goes through `/api/v1` on the app (`https://feega.app`, or your own instance). Send `Authorization: Bearer <token>`: a session token from `feega login` or a `feega_` API key.

The surface changes with the app. Prefer the MCP tools or the CLI; the routes below are the stable entry points they use.

## Read and change a canvas

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/v1/edit` | Run one op or a batch from the [edit catalogue](/reference/generated/edit-ops/) |
| `POST` | `/api/v1/view` | `canvas_summary`, `get`, `activity`, `snapshot` |
| `POST` | `/api/v1/org/query` | Read any org table (`table`, `columns`, `where`, `order`, `limit`, `offset`, `embed`) |
| `POST` `PUT` `DELETE` | `/api/v1/org/rows` | Insert, update, delete rows |
| `GET` | `/api/v1/org/node-types` | JSON Schema of `nodes.data` per node type |
| `GET` | `/api/v1/projects/{projectId}/canvases` | A project's canvases |

## Generation and effects

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/v1/org/nodes/{id}/generate` | Fill a node, like the Generate button |
| `GET` `POST` `DELETE` | `/api/v1/org/nodes/{id}/loop` | Preview, run, cancel a loop over a node's inputs |
| `POST` | `/api/v1/org/nodes/{id}/apply-effects` | Render an effect stack (no credits) |
| `GET` | `/api/v1/org/effects` | Image effects |
| `GET` `POST` | `/api/v1/org/custom-effects` | Custom shader effects (`PATCH`/`DELETE` on `/{id}`) |
| `GET` `POST` | `/api/v1/org/layouts` | Composition layouts (`PATCH`/`DELETE` on `/{id}`) |
| `POST` | `/api/v1/studio/quote` | Price a Photo studio batch: count, credits, `quoteId` |
| `POST` | `/api/v1/studio/start` | Start a batch; needs the `quoteId` of the same selection, 409 if stale |
| `GET` | `/api/v1/studio/{batchId}` | Batch items and state |
| `POST` | `/api/v1/prompts/enhance` | Rewrite a prompt for a model |
| `GET` | `/api/v1/org/media` | Signed media links |

## Motion

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/v1/motion` | Motion videos |
| `POST` | `/api/v1/motion/{nodeId}/ask` | Ask the frame agent; poll `GET /api/v1/motion/runs/{runId}` |
| `POST` | `/api/v1/motion/{nodeId}/render` | Render to MP4; poll `GET /api/v1/motion/renders/{runId}` |
| `GET` `POST` | `/api/v1/motion/{nodeId}/revisions` | List and restore revisions |
| `GET` `POST` `PATCH` | `/api/v1/motion/{nodeId}/storyboard` | Storyboard |
| `GET` `POST` `DELETE` | `/api/v1/motion/{nodeId}/embed` | Publish an embed |
| `GET` | `/api/v1/motion/templates`, `/api/v1/motion/shader-effects` | Templates and shader effects |

## Org and team

| Method | Path | Does |
|---|---|---|
| `GET` `POST` | `/api/v1/orgs` | List and create orgs; `PUT /api/v1/orgs/active` switches |
| `GET` `POST` | `/api/v1/orgs/{orgId}/team` | Members and invites |
| `GET` `PUT` | `/api/v1/org/model-allowlist` | [Model allow-list](/ai/model-allow-list/) |
| `GET` `PUT` | `/api/v1/org/spend-caps` | [Spend limits](/ai/spend-limits/) |
| `GET` | `/api/v1/gallery` | Public gallery; `POST /api/v1/gallery/{id}/remix`, `POST /api/v1/gallery/publish` |
| `GET` | `/api/v1/version` | Server version |

Input fields per operation: the [MCP tools](/reference/generated/mcp-tools/) page, generated from the server.
