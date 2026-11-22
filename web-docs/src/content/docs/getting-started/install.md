---
title: Install
description: Install Feega in VS Code, Cursor, Windsurf or VSCodium, or run it with npx feega.
sidebar:
  order: 2
---

## Requirements

- VS Code 1.90 or newer (or Cursor, Windsurf, VSCodium on the same engine).
- A project whose dev server runs with `npm run dev` or similar.
- `npx feega` needs Node 20 or newer.
- macOS, Windows or Linux.

## In your editor

| Editor | Where |
|---|---|
| VS Code | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega), id `andreabuttarelli.feega` |
| Cursor | [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega) |
| Windsurf | [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega) |
| VSCodium | [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega) |

Or open the Extensions view, search for **Feega** and install. A walkthrough with screenshots is on [Feega in VS Code](https://www.feega.app/integrations/vscode).

## In the browser, with npx

```bash
cd my-app
npx feega
```

Feega finds the app, starts its dev server and opens the editor in your browser. Options:

```
npx feega [dir] [--port N] [--no-open]
```

| Option | Meaning |
|---|---|
| `dir` | The app folder. Default: the current one. With several apps inside, Feega asks which. |
| `--port N` | Port of the editor. Default: a free one. |
| `--no-open` | Print the editor URL instead of opening the browser. |
| `--help`, `--version` | Help and version. |

Ctrl+C stops the editor and the dev server.
