# feega

Design your running web app in the browser. Click an element, change its colour, spacing, font
or text, and the edit lands in your source: a Tailwind class when the project uses Tailwind, a
rule in the component's own stylesheet otherwise. No account, no cloud, no copy of your code.

```bash
cd my-app
npx feega
```

Feega finds the app, starts its dev server and opens the editor in your browser.

## Usage

```
npx feega [dir] [--port N] [--no-open]
```

| Option | |
|---|---|
| `dir` | the app folder (default: the current one). With several apps inside, Feega asks which |
| `--port N` | port of the editor (default: a free one) |
| `--no-open` | print the editor URL instead of opening the browser |
| `--help`, `--version` | |

Ctrl+C stops the editor and the dev server.

- **Frameworks**: SvelteKit, Vite (React, Vue, Svelte), React Router, Next.js, Nuxt, Astro and
  more. The dev command is detected from `package.json`.
- **Undo, redo, Changes**: every edit is a step you can undo or revert from the Changes tab.
- **Open in editor**: opens the source in VS Code at the line (`code -g`), else `$VISUAL` /
  `$EDITOR`, else prints the path.
- **Settings**: `.feega/settings.json` in the app folder (styling mode, dev command, default
  device). `.feega/state.json` keeps the editor layout and edit history: add `.feega/` to
  `.gitignore` if you do not want it committed.

Node 20 or newer.

## VS Code

The same editor runs inside VS Code:
[Feega Inspect](https://marketplace.visualstudio.com/items?itemName=AndreaButtarelli.feega-inspect).

## Support

- Star on GitHub: https://github.com/andreabuttarelli/feega
- Support with a coffee: https://buy.stripe.com/5kQ00k2A97C08sd94LeME07
- Issues: https://github.com/andreabuttarelli/feega/issues

Apache-2.0
