---
title: Local mode
description: One canvas on your machine, saved in a .feega file. No account, no database, no Docker.
sidebar:
  order: 4
---

Local mode runs Feega on your computer for one canvas. Everything you draw is saved in a single
`.feega` file, the same file feega.app imports. Saving runs in the background a moment after each
change and replaces the file in one step, so the canvas never waits for it and a crash leaves the
last complete save.

```sh
npx feega my-canvas.feega
```

You need Node 22 or later. The browser opens on http://localhost:5173 and the terminal prints
where the file is saved, relative to the folder you ran the command in. Each start checks for a newer
version and downloads it once into `~/.feega/app/<version>/`; offline it starts the newest one
already downloaded. Options:
`--port 8080`, `--no-open`. If the file does not exist it is created; every change is written back to it within a second, and again when
you stop the server with Ctrl-C.

## Import the folder you are in

Run `npx feega` inside a project with a `dev` script (React, Vue, Svelte, Next and similar) and it
asks once, when the `.feega` file does not exist yet:

```sh
$ npx feega
feega: import the current folder (my-app) into the canvas? (Y/n)
```

Yes starts the project's dev server, captures its home page and draws it as a frame, the same as
[Import from code](/integrations/import-from-code/) with a local folder. Publishing the frame writes
your canvas edits back to the folder's files. `--import` imports without asking (also outside a
terminal), `--no-import` never asks.

## From a clone

```sh
git clone https://github.com/andreabuttarelli/feega && cd feega && npm install
npm run local -- my-canvas.feega
```

The first run builds the app, which takes a few minutes.

## With an agent

Connect an agent with the local MCP server, which needs no `feega login`. The remote server
(`mcp.feega.app`) does not see a local canvas. Use the port `npx feega` printed:

```sh
claude mcp add feega-local -- npx -y feega mcp --port <port>
```

**Connect** next to the project name shows this and the Codex, Cursor and Claude Desktop configs
with the port filled in; all of them are in [Local MCP](/integrations/mcp/#local-mcp). What an
agent adds or changes appears live in your browser.
`canvas_file` with `action: "save"` writes a copy of the file wherever you ask.

## Chat with your own agent

The **Chat** tab talks to an agent already installed on your computer, through the
[Agent Client Protocol](https://agentclientprotocol.com). Feega looks for the agents on your
machine when the tab opens: on your `PATH`, in `~/.local/bin`, `/opt/homebrew/bin`,
`~/.npm-global/bin`, `~/.bun/bin` and the `npx` cache. It only runs each agent's `--version`;
it never installs anything.

The chat in local mode never spends Feega credits, with or without a connected account: it runs
the agent you pick, on your plan with it. Until you pick one the menu reads *none picked* and the
message box stays off. The **Agent** menu at the top of the tab lists every agent it knows, with the installed version and a badge:

| Badge | Means |
|---|---|
| Ready | installed and signed in (a credentials file or an API key in the environment) |
| Installed | installed; Feega can't tell whether it's signed in (the login lives in the keychain) |
| Needs login | installed, not signed in: the row shows the login command with a **Copy** button |
| Needs npx | installed, but its ACP adapter runs through `npx`, which isn't there |
| Not installed | greyed out, with the install command and a **Copy** button |

**Detect again** reruns the detection after you install or log in. The choice is saved in the
`.feega` file, so it comes back the next time you open it.

| Agent | Runs over ACP with | Install |
|---|---|---|
| Claude Code | adapter `@agentclientprotocol/claude-agent-acp` via `npx` | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Codex CLI | adapter `@agentclientprotocol/codex-acp` via `npx` | `npm install -g @openai/codex` |
| Gemini CLI | `gemini --acp` | `npm install -g @google/gemini-cli` |
| Cursor Agent | `cursor-agent acp` | `curl https://cursor.com/install -fsS \| bash` |
| Amp | adapter `amp-acp` via `npx` | `npm install -g @sourcegraph/amp` |
| OpenCode | `opencode acp` | `curl -fsSL https://opencode.ai/install \| bash` |
| Goose | `goose acp` | `brew install block-goose-cli` |
| Qwen Code | `qwen --acp` | `npm install -g @qwen-code/qwen-code` |
| GitHub Copilot CLI | `copilot --acp` | `npm install -g @github/copilot` |
| Kimi CLI | `kimi acp` | `uv tool install kimi-cli` |
| Kiro CLI | `kiro-cli acp` | `curl -fsSL https://cli.kiro.dev/install \| bash` |
| Factory Droid | `droid exec --output-format acp-daemon` | `curl -fsSL https://app.factory.ai/cli \| sh` |
| Auggie CLI | `auggie --acp` | `npm install -g @augmentcode/auggie` |
| Cline | `cline --acp` | `npm install -g cline` |
| Kilo | `kilo acp` | `npm install -g @kilocode/cli` |

From a terminal, `feega agents` prints the same list (`--refresh` to detect again). The desktop
app reads your login shell's `PATH`, so agents installed by Homebrew, `npm` or an install script
are found even when Feega is opened from the Dock.

### Picking the agent's model

Next to the picked agent, a **Model** menu lists the models that agent offers, read live from it
over ACP: Feega keeps no list of its own. The choice is saved per agent in the `.feega` file and
applied at the start of every turn; a saved model the agent no longer offers falls back to its
default. Agents that don't let a client pick a model show no menu.

| Agent | Model menu |
|---|---|
| Claude Code | yes (`configOptions`) |
| Codex CLI | yes (`configOptions`) |
| Gemini CLI | yes (`session/set_model`) |
| OpenCode | yes (`configOptions`, every provider you configured) |
| Cursor Agent | after `cursor-agent login`, if it offers one |

From a terminal:

```bash
feega agents models claude            # list, * marks the one in use
feega agents models claude --set opus # pick one for this file
feega agents models claude --clear    # back to the agent's default
feega agents models claude --refresh  # ask the agent again
```

The endpoint is `GET`/`PUT /api/v1/local/acp/agents/<agent>/models`: `GET` answers
`{ models, current, chosen }` (`models` is `null` when the agent offers no choice, `?refresh=1`
asks it again), `PUT { model }` saves one the agent offers, `{ model: null }` clears it.

Each message starts the agent, hands it Feega's MCP server and streams its reply into the tab.
The agent edits the canvas only through Feega's tools: it gets no file or terminal access from
Feega. Before each tool call the tab shows what it wants to run with the agent's choices
(**Allow**, **Reject**, ...); nothing runs until you pick one. Usage is billed to your agent's own
account, never to Feega.

The endpoint behind it is `POST /api/v1/local/acp`, local mode only: `{ agent, prompt }` answers
with a `text/event-stream` of `update`, `permission`, `done` and `failed` events, and
`{ permission: { id, optionId } }` answers a pending permission. An agent that isn't installed,
or can't run over ACP here, answers `409`. `GET /api/v1/local/acp/agents` (add `?refresh=1` to
detect again) returns `{ agents, chosen }`; `PUT` with `{ agent }` (an id, or `null` for Feega
cloud) saves the choice in the file.

## AI generation with your own keys

Put the keys in the process environment (`KIE_API_KEY=… npx feega`) or in a `.env` file in the
folder you run `npx feega` from (from a clone, the repo's `.env` works too). The environment wins
over `.env`, and the current folder's `.env` over the app's. Then start local mode:

| Provider | Variables | Generates |
|---|---|---|
| Kie.ai | `KIE_API_KEY` | images, video, text |
| OpenRouter | `OPENROUTER_API_KEY` | images, video |
| Text LLM | `LLM_API_KEY` (`LLM_BASE_URL` for a gateway other than OpenRouter) | text, prompt enhancement; also counts as the OpenRouter key |
| Higgsfield | `HIGGSFIELD_API_KEY_ID` + `HIGGSFIELD_API_KEY_SECRET` | images, video |
| Wiro | `WIRO_API_KEY` (+ `WIRO_API_SECRET` if your Wiro project signs requests) | 3D models |
| ElevenLabs | `ELEVENLABS_API_KEY` (`ELEVENLABS_BASE_URL` optional) | voice-over, sound effects, music, voices |

With at least one provider's keys the AI nodes appear and generate straight against the
provider: no plan, no credits. The model picker lists only models whose provider key you set. Each
run is billed by the provider to your own account.

Keys are read from the environment only. They are never written to the `.feega` file, sent to the
browser or logged. Generated images and videos are stored inside the `.feega` file, so the canvas
stays one portable file. Without a key the nodes stay hidden and generation answers with a message.
Local mode does not run feega's content moderation: prompts, text and references go straight to
your provider, and what you generate is your responsibility. At start the terminal prints, per provider, `key works`, `key rejected` or
`key unreachable`, from a free account call (never a generation).

Wiro's image and video models are for uncensored projects, which local mode does not have, so
locally Wiro runs the 3D nodes only.

## First run

The first time Feega runs on your computer it shows a short setup:

1. **Sign in**, optional, shown only without a connected account: the same sign-in card as feega.app. Email and password sign in right there; **Continue with Google**, **Continue with GitHub** and **Create one** open the same browser sign-in as `feega login`. Either way the session is saved where `feega login` saves it (`~/.config/feega/session.json`; the password is never stored) and the setup moves on by itself. **Skip** goes on without an account. Your file stays on your disk either way.
1. **Where it runs**: stay on this computer, or pick Feega Cloud and **Open feega cloud** in your browser, where you import the `.feega` file. Without an account Feega Cloud is shown but cannot be picked: *sign in to use Feega Cloud*, with a link back to the sign-in step.
1. **Your AI.** The coding assistants found on this computer, with the command to install or sign in to the ones that are not ready. Pick one to use in the chat.
1. **Your memory**, only with a connected account. Feega lists the instruction files it found (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, and `CLAUDE.md` / `AGENTS.md` in the folder you started from). Nothing is read until you press *read these files*, and you can edit the text before saving. It is stored on your account and given to the Feega Cloud chat.

Skip closes the setup. It does not come back: the flag lives in `~/.feega/onboarding.json`.

## What needs the cloud

Sharing, comments and saved versions answer with a message instead of running. Import the
file at feega.app to use them: canvas menu or home page, **Import .feega**.

Share, credits, comments, saved versions and Drive/Dropbox import are not shown.

To open a different file, stop the server and start it again with that file.

## Telemetry

On start, `npx feega` sends one anonymous event to PostHog (EU): `npx_feega_started`, plus
`npx_feega_active_day` on the first start of each day. Each carries the Feega version, OS, CPU
architecture, Node version and a random install id stored in `~/.feega/telemetry-id`. No IP or
location is kept, and no canvas content, file names, paths or project names are sent. The first
run prints a one-line notice. A failed send is ignored and never delays startup.

Turn it off with `FEEGA_TELEMETRY=0` or `DO_NOT_TRACK=1`; it is also off when `CI` is set.

## Safety

There is no login, so the server listens on 127.0.0.1 only and refuses to start on any other
address.
