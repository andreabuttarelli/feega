---
title: Use Feega with AI agents
description: Install the Feega skill so Claude Code, Cursor or Codex can set up a project for Feega and write code it can edit.
sidebar:
  order: 6
---

Feega has no AI of its own. It sits next to your agent: you design in Feega, your agent codes, both write the same files.

## Install the skill

```bash
npx skills add andreabuttarelli/feega
```

In Claude Code, install it as a plugin:

```
/plugin install feega --marketplace andreabuttarelli/feega
```

The skill teaches your agent to:

- add `feega-source-map` to a Next.js or Vite config,
- start the editor with `npx feega`, or point you to **Feega: Open from current workspace**,
- write markup Feega can edit: literal Tailwind classes, text in the markup, loops over array literals, icons from supported libraries.

## Use it

Ask in plain words: "set this project up for Feega", "start Feega", "build this card so I can tweak it in Feega".

To let the agent read the element you selected in Feega, [connect it via MCP](/more/connect-your-agent-via-mcp/).
