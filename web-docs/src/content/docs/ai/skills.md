---
title: Skills
description: Prompt skills in the app, and the feega agent skill.
sidebar:
  order: 4
---

## Prompt skills (in the app)

Type `/` in a prompt to insert a saved snippet. Save any prompt as a skill your whole team can reuse.

## Agent skill (for coding agents)

The `feega` skill teaches Cursor, Claude Code, Codex and others to drive feega via MCP or the CLI:

```bash
npx skills add andreabuttarelli/feega --skill feega
```

Sources: `cli/skills/feega/` (`SKILL.md` and `references/`). A Claude/Codex plugin bundling the skill and the remote MCP lives in `cli/plugins/feega/`.
