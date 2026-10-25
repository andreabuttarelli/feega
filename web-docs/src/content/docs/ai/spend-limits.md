---
title: Spend limits
description: Cap what members and projects can spend on generation.
sidebar:
  order: 6
---

Owners and admins set spending limits in US dollars, optionally reset every month.

| Scope | Caps |
|---|---|
| `org_member` | each member across the org |
| `project_member` | each member inside one project |
| `project_total` | the whole project |

| Where | How |
|---|---|
| App | Settings |
| CLI | `feega caps` reads; `feega caps set <scope> <usd> [--project <id>] [--reset none\|monthly]`; `off` as `<usd>` removes a cap |
| MCP | `spend_caps`: without `scope` it reads; with `scope` and `cap_usd` (`null` removes) it sets, admins only |

Self-hosted instances are not credit-gated ([Self-hosting](/self-hosting/)).
