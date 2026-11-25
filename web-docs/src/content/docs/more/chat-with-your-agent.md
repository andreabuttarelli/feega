---
title: Chat with your coding agent
description: Talk to Claude Code, Codex, OpenCode, Gemini CLI, Grok Build and other ACP agents from the AI tab, with the selected element attached.
sidebar:
  order: 7
---

The **AI** tab, next to Properties and Changes, is a chat with the coding agent already installed on your machine. Feega uses your own subscription and login: it adds no model, key or billing.

It works in the VS Code extension and in `npx feega`.

## Supported agents

Feega talks to agents over the [Agent Client Protocol](https://agentclientprotocol.com). The agent picker lists the ones it finds on your machine; the others appear dimmed under **Not installed** inside the picker, with the command to install them.

| Agent | Started as |
| --- | --- |
| Claude Code | `@agentclientprotocol/claude-agent-acp` (adapter) |
| Codex | `@agentclientprotocol/codex-acp` (adapter) |
| Pi | `pi-acp` (adapter) |
| OpenCode | `opencode acp` |
| Gemini CLI | `gemini --acp` |
| Grok Build | `grok agent stdio` |
| Cursor Agent | `cursor-agent acp` |
| GitHub Copilot | `copilot --acp` |
| Goose | `goose acp` |
| Qwen Code | `qwen --acp` |
| Kiro | `kiro-cli acp` |
| Devin | `devin acp` |
| Augment | `auggie --acp` |
| Cline | `cline --acp` |
| Kimi CLI | `kimi acp` |
| Qoder | `qodercli --acp` |
| Factory Droid | `droid exec --output-format acp` |
| Mistral Vibe | `vibe-acp` |

Claude Code, Codex and Pi need a small open-source adapter. Feega downloads it once from npm, at an exact pinned version, with your own `npm install` into its own storage folder (the extension's storage in VS Code, the `feega` cache folder for `npx feega`). Nothing is installed globally and no `npx` runs later: the adapter starts directly with Node.

The download happens in the **Connect Feega to your agents** onboarding step, which shows "Feega downloads the Claude Code connector from npm" with its progress, or the first time you open a chat with that agent, which shows **Connecting…**. It needs Node.js with `npm` and a network connection once. If either is missing, the chat shows the reason with a **Retry** button. When Feega updates an adapter version, the old one is deleted.

## Talk to the website

Select an element in the preview, then write. The element is attached to your message as a chip with its file, line and selector, and how widely it is shared. Remove the chip with the **×** to send the message without it.

## Let the agent see the page

When the agent accepts images, a **camera** button appears next to Send. It attaches a screenshot of the tab you are looking at: the page, or the component in the focus tab. Up to three screenshots go with the next message; remove one with its **×**.

Feega also starts a small local server beside the agent, with two tools the agent can call on its own:

- `feega_screenshot` returns a screenshot of the current tab. Pass `selection` to crop it to the selected element.
- `feega_context` returns the same block the message box attaches: the selected elements with file, line and selector, plus the page, preview width, breakpoint, theme, state and focused component.

The screenshot is drawn inside your page and goes from the editor to the agent on your machine; Feega does not upload it. Agents that do not accept images get no camera button. The same tools are available to any agent through [`npx feega mcp`](/more/connect-your-agent-via-mcp/).

## What the agent can do

- Replies stream in as the agent writes them, with its plan and tool calls.
- Before a tool that changes something, the agent asks: **Allow** or **Reject**. A file write shows its diff first.
- The picker at the bottom left of the message box sets how much it may do without asking. It lists the modes the agent itself offers (for Claude Code: Default, Accept edits, Plan and so on), and Feega's own choice: **Ask every time**, **Allow edits, ask for commands** or **Allow all**. Each project remembers its choice, and the `feegaInspect.aiPermissions` setting sets the default. **Allow all** is tinted as a warning.
- Next to it, the **Model** and **Effort** pickers show the choices the agent advertises, with its own names (for Codex, "Reasoning effort"). Agents that list their models separately, such as Gemini CLI, still get the **Model** picker; their effort picker appears only if they offer one. They are hidden when the agent offers none. Each chat remembers its choice and restores it when you reopen the chat; a new chat starts with what you last picked for that agent.
- **Stop** cancels the current turn.
- Files the agent writes land in the **Changes** tab as one change each, marked with the agent's name. [Undo them](/editing/undo-and-changes/) like any other change.

## Notifications

When an agent finishes a turn or asks for permission and you are not looking at Feega, Feega tells you. The message names the agent and the project, never code or your prompt: "Claude Code finished in shop", "Claude Code needs permission to run a command". Stopping a turn yourself sends nothing.

You are not looking when the panel is hidden or the window is in the background. In the desktop app, another tab being active counts too.

- **VS Code:** a message with an **Open** button. Permission requests show as a warning. **Open** brings the panel forward and opens the chat.
- **`npx feega`:** a browser notification. The browser asks for permission the first time. Clicking it focuses the tab and opens the chat.
- **Desktop app:** a system notification. The dock icon shows a badge while a permission request waits, and clears it when you answer. Clicking the notification focuses the window, switches to the tab and opens the chat.

Turn them off in the Feega menu under Settings, or with [`feegaInspect.notifications`](/more/settings/). `feegaInspect.notifyFinished` and `feegaInspect.notifyPermission` switch each kind off on its own.

## Chats

Every chat is saved on your machine, per project, with its agent, mode and messages. Close Feega and reopen it: the chats are still there.

The clock icon at the top right of the AI tab opens the list. Each row shows the agent, the first prompt as the title, how long ago it was active, and a green dot while the agent is working. **New chat** starts another one; hover a row to rename or delete it. Deleting asks first.

Chats run in parallel. Switching to another chat does not stop the one that is working. At most four agents run at once; an idle one is parked to make room, and if all four are busy Feega says so.

When you write in an old chat, Feega asks the agent to load its earlier session, if it supports that, so it keeps the context. If not, the history stays visible, a note says "New session — the agent doesn't remember earlier messages", and the agent starts fresh.

Feega signs in to agents that ask for it with the login method they offer (for example Cursor Agent after `agent login`).

The agent runs in your project folder. It can only read and write files inside it.
