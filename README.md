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

<p>
<img src="docs/readme/logos/editor-vs-code.svg" height="22" alt="VS Code"> VS Code &nbsp; <img src="docs/readme/logos/editor-cursor.svg" height="22" alt="Cursor"> Cursor &nbsp; <img src="docs/readme/logos/editor-windsurf.svg" height="22" alt="Windsurf"> Windsurf &nbsp; <img src="docs/readme/logos/editor-vscodium.svg" height="22" alt="VSCodium"> VSCodium &nbsp; <img src="docs/readme/logos/editor-npx-feega.svg" height="22" alt="npx feega"> npx feega
</p>

- **VS Code**: [Marketplace](https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega)
- **Cursor, Windsurf, VSCodium**: [Open VSX](https://open-vsx.org/extension/AndreaButtarelli/feega)
- **Any browser**: `npx feega`

## How it works

1. Run your app, open Feega and click any element.
2. Edit it from the design panel, including responsive sizes.
3. Feega writes the change to your source. Every edit is a diff you can review and undo.

## Frameworks

<p>
<img src="docs/readme/logos/framework-sveltekit.svg" height="22" alt="SvelteKit"> SvelteKit &nbsp; <img src="docs/readme/logos/framework-react.svg" height="22" alt="React"> React &nbsp; <img src="docs/readme/logos/framework-next-js.svg" height="22" alt="Next.js"> Next.js &nbsp; <img src="docs/readme/logos/framework-vue.svg" height="22" alt="Vue"> Vue &nbsp; <img src="docs/readme/logos/framework-tailwind.svg" height="22" alt="Tailwind"> Tailwind
</p>

SvelteKit, React, Next.js and Vue, with Tailwind or plain CSS (CSS modules, scoped `<style>`).

## Works with your agent

Feega has no AI of its own, so it sits next to the agent you already use: you design, your agent codes, same files, every change a diff.

Teach your agent Feega ([docs](https://docs.feega.app/more/ai-agents/)):

```bash
npx skills add andreabuttarelli/feega
```

In Claude Code:

```
/plugin install feega --marketplace andreabuttarelli/feega
```

<p>
<img src="docs/readme/logos/agent-chatgpt.svg" height="22" alt="ChatGPT"> ChatGPT &nbsp; <img src="docs/readme/logos/agent-claude.svg" height="22" alt="Claude"> Claude &nbsp; <img src="docs/readme/logos/agent-gemini.svg" height="22" alt="Gemini"> Gemini &nbsp; <img src="docs/readme/logos/agent-opencode.svg" height="22" alt="OpenCode"> OpenCode
</p>

## Develop

The editor lives in `inspect/` (VS Code extension) and `npx/` (standalone), sharing one host core, on the [`feat/feega-inspect`](https://github.com/andreabuttarelli/feega/tree/feat/feega-inspect) branch until it lands on `main`.

```bash
cd inspect && npm install && npm test
cd npx && node --test
```

The site is in `landing/`.

## Contributing

Issues and pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Feega Cloud (GitHub sync, collaboration, sections and templates) is coming later.

## License

[Apache-2.0](LICENSE)

## Support

[Star the repo](https://github.com/andreabuttarelli/feega), or [support Feega with a coffee](https://buy.stripe.com/5kQ00k2A97C08sd94LeME07).
