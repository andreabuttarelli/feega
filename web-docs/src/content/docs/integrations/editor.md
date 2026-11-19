---
title: Cursor and VS Code
description: Open .feega canvases inside Cursor, VS Code and other VS Code editors, with the local MCP server registered for your agent.
sidebar:
  order: 2
---

The Feega extension opens your workspace folder as a Feega project in an editor tab. It runs
[local mode](/getting-started/local-mode/) on that folder, so there is no account, and saves the
canvas to the folder's [`.feega/` directory](/getting-started/project-folder/) as you work, ready to
commit with the rest of the repo.

Install it from the extensions view: search **Feega**. It is published as
`AndreaButtarelli.feega` on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AndreaButtarelli.feega)
for VS Code, and on [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega) for
Cursor, Windsurf and VSCodium. From a terminal:

```bash
code --install-extension AndreaButtarelli.feega
cursor --install-extension AndreaButtarelli.feega
```

Each version is also attached to its GitHub release as a `.vsix` file, for editors that install
from a file. The extension needs Node 22 or later on your machine.

- **Feega: Open this folder as a project** (command palette): opens the workspace folder. The canvas
  lives in `.feega/`; commit it like any other folder. Only `.feega/.base/` and `.feega/.ours/` stay
  out of git, through the `.gitignore` Feega writes inside `.feega/`. A `<folder>.feega` file left by
  an earlier version is moved to `.feega` and turned into the folder on open (the old file is kept
  as `.feega/legacy.feega`).
- **Open a `.feega` file**: it opens as a canvas. The first time, the app downloads once.
- **Feega: Import this folder into a canvas**: opens the folder as a project and draws its pages on
  the canvas, as `npx feega --import` does: every static page the router finds, up to 20. Pages that
  need a value (`/blog/[slug]`) are skipped and listed in the **Feega** output. A project with no
  router found imports its home page only. In a monorepo a quick-pick asks which app to import.
  While it runs, the tab lists each step: download the app, start Feega, find pages, install the
  project's dependencies (when `node_modules` is missing, with the manager its lockfile names),
  start its dev server, import page N of M. A failing step turns red with the reason and the end of
  the dev server's log, and **Retry** starts over. When it finishes the canvas replaces the list,
  and a notification says how many pages landed.

## Git

When the folder is a git repository, the top bar shows its git group as soon as the canvas opens,
for the whole project, not only for frames imported from code:

- the current branch;
- the number of changed files in `.feega/`, with a button that commits them (only `.feega/` goes in
  the commit);
- the number of commits not yet on `origin`, with a button that pushes the branch;
- when `origin` is on GitHub, a pull request button: it pushes with your own git credentials and
  opens GitHub's compare page. Feega reads no token.

## Try unreleased code

The extension normally runs the last release with `npx feega@latest`. To run a clone of the Feega
repo instead, for example the `dev` branch, set **Feega: Dev Server Path** (`feega.devServerPath`)
to the clone's path. The canvas then starts with `node <clone>/scripts/local.mjs <folder>`, which
builds the app once if `build/` is missing; after pulling new code, run `npm run build:node` in the
clone. Folder import (`--import`) is not available in this mode. Clear the setting to go back to
the release.

## Your agent

While a canvas is open, the extension registers its local MCP server, named `feega <file>`:
in VS Code through the MCP server list, in Cursor through Cursor's MCP settings. The agent in the
chat edits the canvas you are looking at, and you see its changes live. Close the tab and the
server goes away.

Other agents, such as Claude Code in a terminal, connect with `npx -y feega mcp --port <port>`;
the port is in the **Feega** output panel. See [MCP setup](/integrations/mcp/#local-mcp).
