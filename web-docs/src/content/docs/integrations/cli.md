---
title: CLI
description: The feega command line.
sidebar:
  order: 2
---

The CLI is a thin HTTP client: it never touches the database and only calls `/api/v1`.

```bash
curl -sSL https://raw.githubusercontent.com/andreabuttarelli/feega/main/cli/scripts/install.sh | bash
feega login
```

Local dev servers on `localhost:5173` are auto-detected; override with `PUBLIC_APP_URL`.

## Commands (from `cli/cli.ts`)

| Command | Does |
|---|---|
| `login`, `logout` | Sign in and out |
| `orgs` (`create`, `use`), `team` | Organizations and members |
| `projects`, `canvases <projectId>` | List |
| `canvas op <projectId> <op>` | Run a canvas op |
| `canvas models`, `canvas export`, `canvas frame`, `canvas upload` | Models, export, frames, file upload |
| `motion ask <nodeId> <prompt>` | Ask the frame editor agent |
| `motion render`, `render-status`, `run` | Render and poll |
| `motion list`, `shaders`, `templates`, `new`, `add-template` | Videos, shader effects, templates |
| `motion embed`, `share`, `still`, `frames`, `storyboard`, `revisions`, `budget` | Publish, share, inspect |
| `motion tool`, `op`, `tools`, `move`, `place` | Editor tools and ops |
| `gallery [query]` (`remix`, `publish`, `withdraw`) | The public gallery |
| `effects`, `effects write <name>`, `effects patch <effectId>` | Image effects and custom shader effects |
| `layouts`, `layouts write <name>`, `layouts patch <layoutId>` | Custom composition layouts |
| `studio quote`, `studio start`, `studio status <batchId>` | Photo studio batches: price, start with the quote id, follow |
| `allowlist`, `allowlist set <medium> [ids...]` | [Model allow-list](/ai/model-allow-list/) |
| `caps`, `caps set <scope> <usd>` | [Spend limits](/ai/spend-limits/) |
| `app-account <projectId>` | The test app account a project remembers |
| `media` | Signed links to node, run or asset media |
| `health`, `update` | API status, self-update |

`feega <command> --help` shows flags. Direction of change is app, then CLI, then MCP.
