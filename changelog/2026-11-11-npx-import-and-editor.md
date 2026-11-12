# `npx feega` imports the current folder; Feega extension for Cursor and VS Code

The pen.dev teardown (`teardowns/pencil.dev/playbook.md`) showed their growth came from an editor
extension (about 1.5M Open VSX downloads) and a file format that lives in the repo. Feega already
had both halves (`.feega` local mode, local folder import with write-back) but no way in from the
editor and no prompt to bring existing code in.

- `npx/launcher.mjs`: `importStep` decides ask / import / skip from a table keyed on
  `--import` / `--no-import` (default ask). It asks only in a TTY, only in a folder whose
  `package.json` has a `dev` script, and only when the `.feega` file doesn't exist, so reopening
  a canvas never re-imports. The launcher reads project and canvas from the local home redirect
  and calls the existing `POST /api/v1/projects/:id/code-import` with `folder`. No app change, so
  it works with the app versions already released.
- `vscode/`: plain-JS extension, no build. A read-only custom editor for `*.feega` spawns
  `npx feega@latest <file> --port <free> --no-open` (no import flag: without a TTY the launcher never asks, and released launchers reject `--no-import`) and iframes it. MCP is registered
  per open canvas through `vscode.lm.registerMcpServerDefinitionProvider` (VS Code) and
  `vscode.cursor.mcp.registerServer` (Cursor).
- Imports only `/`: asking for routes would bring the form back; more pages can be added from the
  canvas.
- Not done: a bundled app inside the extension (rejected: ~hundreds of MB per platform), and
  remote cloud canvases in the editor.
