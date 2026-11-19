<p align="center"><img src="docs/readme/logos/mark.svg" width="56" alt="Feega"></p>

<h1 align="center">Feega</h1>

<p align="center"><b>A free, open-source visual editor for your codebase.</b><br>Click any element of your running app, edit it like in Figma, and the change is written to your code. No AI, no tokens, every edit a diff.</p>

<p align="center">
<a href="https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega"><img alt="VS Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/andreabuttarelli.feega?label=marketplace&style=flat-square&color=ff5100&labelColor=121212"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega"><img alt="Installs" src="https://img.shields.io/visual-studio-marketplace/i/andreabuttarelli.feega?label=installs&style=flat-square&color=ff5100&labelColor=121212"></a>
<a href="https://open-vsx.org/extension/AndreaButtarelli/feega"><img alt="Open VSX" src="https://img.shields.io/open-vsx/v/AndreaButtarelli/feega?label=open%20vsx&style=flat-square&color=ff5100&labelColor=121212"></a>
<a href="https://www.npmjs.com/package/feega"><img alt="npm" src="https://img.shields.io/npm/v/feega?style=flat-square&color=ff5100&labelColor=121212"></a>
<a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-ff5100?style=flat-square&labelColor=121212"></a>
<img alt="Platforms" src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-ff5100?style=flat-square&labelColor=121212&label=platforms">
</p>

<p align="center"><a href="https://feega.app/video/feega-demo.mp4"><img src="docs/readme/feega-demo.gif" alt="Feega demo: select an element, edit it, review the diff" width="720"></a><br><sub><a href="https://feega.app/video/feega-demo.mp4">Watch the full-quality video</a></sub></p>

## What it is

Feega is a VS Code extension, also available for Cursor, Windsurf and VSCodium, plus a standalone `npx feega` for any browser. It opens your running app, lets you select any element and edit size, spacing, colour, type and layout from a design panel. Feega finds the source of the element and writes the change as Tailwind classes or real CSS.

It runs on macOS, Windows and Linux. Everything is local: no account, and nothing about your code or your app leaves your machine.

| Select | Edit | Review |
|---|---|---|
| <img src="docs/readme/feega-select-edit.gif" width="260" alt="Selecting and editing an element"> | <img src="docs/readme/feega-colour.gif" width="260" alt="Changing a colour"> | <img src="docs/readme/feega-diff.gif" width="260" alt="Reviewing the changes as a diff"> |

## Install

- **VS Code**: [Marketplace](https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega)
- **Cursor, Windsurf, VSCodium**: [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega)
- **Any browser**: `npx feega`

## How it works

1. Run your app, open Feega and click any element.
2. Edit it from the design panel, including responsive sizes.
3. Feega writes the change to your source. Every edit is a diff you can review and undo.

## Frameworks

<p>
<img src="docs/readme/logos/react.svg" height="28" alt="React"> <img src="docs/readme/logos/next.svg" height="28" alt="Next.js"> <img src="docs/readme/logos/svelte.svg" height="28" alt="SvelteKit"> <img src="docs/readme/logos/vue.svg" height="28" alt="Vue"> <img src="docs/readme/logos/nuxt.svg" height="28" alt="Nuxt"> <img src="docs/readme/logos/astro.svg" height="28" alt="Astro"> <img src="docs/readme/logos/solid.svg" height="28" alt="Solid"> <img src="docs/readme/logos/angular.svg" height="28" alt="Angular"> <img src="docs/readme/logos/vite.svg" height="28" alt="Vite">
</p>

React, Next.js, SvelteKit, Vue, Nuxt, Astro, Solid, Angular and Vite. Styling: Tailwind and plain CSS.

## Works with your agent

Feega has no AI of its own, so it sits next to the agent you already use. You design by hand, your agent reads the diff.

<p>
<img src="docs/readme/logos/claude-code.svg" height="28" alt="Claude Code"> <img src="docs/readme/logos/codex.svg" height="28" alt="Codex"> <img src="docs/readme/logos/cursor.svg" height="28" alt="Cursor">
</p>

Works alongside ChatGPT, Claude, Gemini and OpenCode agents.

## Develop

```bash
# VS Code extension
cd vscode
npm test
npm run test:e2e
npm run package

# npx feega
cd npx
node --test
```

The site is in `landing/`.

## Contributing

Issues and pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Feega Cloud (GitHub sync, collaboration, sections and templates) is coming later.

## License

[Apache-2.0](LICENSE)

## Support

[Star the repo](https://github.com/andreabuttarelli/feega), or [support Feega with a coffee](https://buy.stripe.com/5kQ00k2A97C08sd94LeME07).
