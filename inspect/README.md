# Feega Inspect

Click an element of your running web app inside VS Code, Cursor or Windsurf and edit its design. The change is written to your source: a Tailwind class (or your token) when the project uses Tailwind, CSS otherwise.

Docs: https://docs.feega.app/integrations/inspect/

## Install a local build

```bash
npm install
npm run package
code --install-extension feega-inspect-0.1.0.vsix --force
```

## Develop

1. `npm install` in `inspect/`.
2. Open `inspect/` in VS Code and press F5 (**Run Feega Inspect**). It starts `npm run dev` (host and webview rebuilt on save) and opens `../landing` in an Extension Development Host.
3. In that window run **Feega Inspect: Open the running app**.
4. Edit code: a webview change reloads the panel (route and size kept); a host change restarts the extension host. This only happens in development, never in an installed vsix.

Tests: `npx vitest run inspect/src` from the repo root; VS Code e2e `VSCODE_PATH=… npm run test:e2e`; round-trip matrix `npx tsx test/matrix.mts <app> <text selector> <box selector>`.

## Settings

All in VS Code settings under `feegaInspect.*`, also editable from the Feega menu (top left of the panel): anonymous usage counts, how styles are written (auto / Tailwind / CSS), dev server command, default device.

Anonymous usage counts: none are sent yet. When they are, they will be counts only (opens, edits, framework, styling system), never code or paths, and off when VS Code telemetry is off.
