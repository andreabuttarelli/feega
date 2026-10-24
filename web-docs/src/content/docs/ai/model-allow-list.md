---
title: Model allow-list
description: Choose which image, video and 3D models an organization can use.
sidebar:
  order: 5
---

Owners and admins pick which image, video and 3D models their organization offers. An empty list for a medium means every model.

| Where | How |
|---|---|
| App | Settings |
| CLI | `feega allowlist` reads; `feega allowlist set <medium> [ids...]` replaces (no ids allows every model); `--org <id>` if you belong to several |
| MCP | `model_allowlist`: without `medium` it reads; with `medium` (`image`, `video`, `model3d`) and `model_ids` it replaces, admins only |

A model outside the list is refused when a node generates, with recommended alternatives.
