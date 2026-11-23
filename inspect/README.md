# Feega

Design in your codebase. Click any element of your running app, edit it visually, and the change is written to your code. No AI, no tokens.

Same editor, two ways to run it: this extension inside VS Code, or `npx feega` in your app folder to open it in the browser.

## Open your app

Two ways, both start your dev server and open the app beside your code:

- **From the Explorer:** right-click your app's folder (the one with `package.json`) and choose **Design this folder with Feega**. To open a single page, right-click its file (`.svelte`, `.vue`, `.tsx`, `.jsx`, `.astro`, `.html`) and choose **Design this page with Feega**.
- **From the Command Palette:** press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows, Linux), type **Feega**, and run **Feega: Open from current workspace**. If your app already runs, use **Feega: Open from URL…** and paste its address, e.g. `http://localhost:5173`.

Prefer the browser? Run `npx feega` in your app folder (Node 20 or newer).

![Select an element](images/1-select.png)

## How it works

1. Open your app as above.
2. Click an element. Edit text, spacing, size, colour, radius, typography in the right bar.
3. The edit lands in the source file: a Tailwind class (or your own token) when the project uses Tailwind, CSS otherwise.

![Edit it](images/2-edit.png)

![Written to your code](images/3-result.png)

## Features

- Click to select, breadcrumb to walk parents and siblings
- Text edited in place
- Box, layout, typography and colour controls with a colour picker
- Phone, tablet, desktop and full sizes
- Navigate mode to use the app, design mode to edit it
- Works in VS Code, Cursor and Windsurf
- Selecting an element reveals its source beside Feega with the line selected, so coding agents that read the editor selection (Claude Code, Cursor, Copilot, Cline, Codex, Gemini CLI) see it.

![Colour picker](images/21-colour-picker-dark.png)

## Use with your agent

- **Selection sync.** Selecting an element reveals its source beside Feega with the line selected, without taking focus. Coding agents that read the editor selection (Claude Code, Cursor, Copilot, Cline, Codex, Gemini CLI) see it. Turn off with `feegaInspect.syncSelection`.
- **Copy for agent.** Right-click the element, or use **Copy for agent** in the bar: file:line, selector, component, page, preview width, breakpoint, theme and state go to the clipboard, ready to paste into the agent.

## Supported frameworks

React, Next.js, Svelte, SvelteKit, Vue, Astro and plain HTML, with Tailwind or CSS.

## Privacy

No account needed. Your code never leaves your machine.

## Telemetry

Feega sends anonymous usage counts so we know how many people use it and how. Each event carries:

- a random install id and a random session id (no account, no user id)
- the event: `session_start`, `preview_ready` (your page loaded in the preview), `first_edit` (your first edit ever), `edit` (a change was written to your source), `session_end`
- on `edit`: the kind of change (text, style, image, attribute, structure, template or other)
- on `session_end`: the session duration and the number of edits
- the detected framework (for example `next` or `sveltekit`) and whether you are signed in to Feega
- Feega version, editor (VS Code, Cursor, Windsurf, VSCodium or `npx`), operating system, CPU architecture, and device kind (desktop, web, command line)

The server adds country, region and city from the request, and does not store the IP address.

Never collected: code, file names or paths, project names, URLs, the content of your edits.

Turn it off with either:

- the VS Code setting `feegaInspect.telemetry` (off), or VS Code's own `telemetry.telemetryLevel` set to `off`
- for `npx feega`: the environment variable `FEEGA_TELEMETRY=0` or `DO_NOT_TRACK=1`

## Settings

Under `feegaInspect.*`: anonymous usage counts, how styles are written (auto / Tailwind / CSS), dev server command, default device size.

## Links

- [Docs](https://docs.feega.app/getting-started/quick-start/)
- [Star on GitHub](https://github.com/andreabuttarelli/feega)
- [Support with a coffee](https://buy.stripe.com/5kQ00k2A97C08sd94LeME07)
