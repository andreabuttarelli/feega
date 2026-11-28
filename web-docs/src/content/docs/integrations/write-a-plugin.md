---
title: Write a plugin
description: Build a Feega plugin as a folder with a manifest and one script, load it while you develop, and publish it on GitHub or npm.
sidebar:
  order: 5
---

A plugin is a folder with two files: `feega-plugin.json` (the manifest) and a script. The script
runs in a sandboxed worker inside the editor and talks to Feega through messages. Feega does not
review third-party plugins, and there is no registry: you share a plugin as a GitHub repository
or an npm package.

A working example is in the repository at
[`examples/feega-plugin-hello`](https://github.com/andreabuttarelli/feega/tree/main/examples/feega-plugin-hello).

## The manifest

```json
{
  "id": "example.hello",
  "name": "Hello",
  "version": "1.0.0",
  "permissions": ["selection"],
  "contributions": {
    "command": [{ "id": "hello", "title": "Say hello" }]
  }
}
```

- `id`: lowercase letters, digits, dots and dashes.
- `version`: `1.2.3`.
- `main`: the script, relative to the folder. Defaults to `plugin.js`.
- `permissions`: see below. An unknown permission, or a manifest that does not parse, is refused
  and nothing is installed.
- `contributions`: where the plugin shows up. Points are `rightBar` (a **Properties** section),
  `overlay` (handles over the preview), `addMenu`, `contextMenu` (with `where`: `layers`,
  `preview` or `both`), `topBar`, `command` (listed in the Feega menu) and `sidePanel` (with
  `html`) and `popover` (a panel an `addMenu` entry opens, named by its `popover` field; the
  plugin renders into it like a `rightBar` section). Entries need an `id`; most need a `title`.
  `when` limits an entry to some selections: `selection`, `attribute:<name>`,
  `!attribute:<name>` and `owned`.
- `owns`: what the plugin's own output looks like on an element, as the same kind of rules:
  `attribute:<name>` or `style:<property>*=<text>`. A section with `"when": ["owned"]` shows only
  on an element that matches, so controls for a plugin's output stay out of the way elsewhere.

## Permissions

A plugin can only do what its manifest asks for. Feega shows the list in plain words and asks
before it installs a plugin.

| Permission | The plugin may |
|---|---|
| `selection` | see which element you select |
| `source` | read the source file of the selected element |
| `project` | read facts about your project (TypeScript, public folder) |
| `edit.style` | change the styles of elements in your code |
| `edit.attributes` | change attributes of elements in your code |
| `edit.insert` | add new elements and component files to your code |
| `edit.dependency` | add packages to your `package.json` |
| `edit.asset` | add files to your project assets |
| `file.pick` | ask you to pick a file from your computer |
| `network:<host>` | send requests to that host and no other |

Edits are proposals. They go through the same edit engine as a manual edit, show in **Changes**
and undo in one step. A proposal with one operation the manifest does not allow is refused whole.

## The script

The worker has no network, storage or sub-workers of its own: `fetch`, `XMLHttpRequest`,
`WebSocket`, `indexedDB`, `Worker` and similar globals are removed. Everything goes through
messages, and the SDK wraps them. Copy `feega-plugin-sdk.js` from
[`packages/plugin-api/sdk`](https://github.com/andreabuttarelli/feega/tree/main/packages/plugin-api/sdk)
into your project (one ES module, no dependencies) and bundle your script as a plain script, as
the worker cannot `import`:

```js
import { runPlugin } from './feega-plugin-sdk.js';

runPlugin((api) => {
  api.command.on(async (command) => {
    const selection = await api.selection.get();
    await api.notify(selection ? `Hello from <${selection.tag}>` : 'Select an element first.');
  });
});
```

```bash
esbuild src/plugin.js --bundle --format=iife --outfile=plugin.js
```

The example folder has this setup, with a `build.mjs` that does the bundling.

The SDK offers `api.selection.get/on/watch`, `api.project.info`, `api.source.text`,
`api.propose(label, ops)`, `api.preview`, `api.fetch`, `api.pickFile`, `api.notify`,
`api.section(id).render/on`, `api.overlay(id).render/on`, and `api.menu`, `api.command` and
`api.action` with `.on`. Each needs the permission listed below.

Under the SDK is a small message protocol, if you prefer to talk to it directly.

A call:

```js
self.postMessage({ type: 'call', id: 1, call: 'selection', args: undefined });
```

The answer comes back as `{ type: 'result', id: 1, ok: true, value }` or
`{ type: 'result', id: 1, ok: false, reason }`.

| Call | Needs | Does |
|---|---|---|
| `selection` | `selection` | the selected element: source, tag, classes, styles, attributes |
| `project` | `project` | `{ typescript, publicDir }` |
| `source-text` | `source` | the text of the selected element's file |
| `propose` | the permission of each operation | `{ label, ops }`, one undoable step |
| `preview` | `edit.style` | show a style on an element without writing it, or clear it |
| `fetch` | `network:<host>` | `{ url }`, answered with `{ status, text }` |
| `pick-file` | `file.pick` | opens the system file dialog |
| `notify` | | `{ text }`, a short message in the editor |
| `render` | | `{ contribution, tree }`, the controls of a `rightBar` section |
| `overlay` | | `{ contribution, handles }`, handles over the preview |

Feega sends signals as `{ type: 'signal', signal, payload }`: `selection`, `control`, `handle`,
`menu`, `command` (`payload.command` is the contribution id) and `action` (a top-bar button).

## Develop

Load the folder while you work on it. It is marked **Dev** and **Not reviewed**, and reloads every
time one of its files changes.

- Terminal: `npx feega plugin dev ./my-plugin` opens the editor on the current folder with the
  plugin loaded.
- VS Code: add the folder to the `feegaInspect.plugins.dev` setting (an array of folders, absolute or
  relative to the workspace).

## Publish

Push the folder to GitHub with a tag, or publish it to npm. `feega-plugin.json` and the script
must be at the root of the repository or package.

```bash
git tag v1.0.0 && git push --tags
npm publish
```

## Install

From a terminal:

```bash
npx feega plugin add github:owner/repo@v1.0.0
npx feega plugin add feega-plugin-hello@1.0.0
npx feega plugin list
npx feega plugin remove example.hello
```

In VS Code, run **Feega: Install plugin…** from the command palette, or use the install box under
**Plugins** in the Feega menu.

- `github:owner/repo[@tag]` downloads the tag archive (the default branch without a tag). An npm
  source downloads the tarball from the npm registry. Nothing else is fetched.
- Feega shows the manifest's permissions in plain words and installs only after you approve.
- Files go to `~/.feega/plugins/<id>/<version>/`. The exact version and the SHA-256 of the archive
  are recorded in `~/.feega/plugins/plugins.json`. Adding the same version again with a different
  archive is refused: publish a new version instead.
- There is no automatic update. Run `plugin add` again with the new tag or version; Feega asks
  again, then replaces the old version.
- If the installed files later ask for more than you approved, the plugin is not loaded.

## Manage

**Plugins** in the Feega menu lists the built-in, installed and dev plugins. Each can be switched
on or off (built-ins too), shows its permissions, and carries a **Not reviewed** badge unless it
is built in. Installed plugins can be removed. The state is kept locally in
`~/.feega/plugins/plugins.json`; no network is involved.
