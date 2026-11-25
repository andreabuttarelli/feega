---
title: Chat with your coding agent
description: Talk to Claude Code, Codex, OpenCode, Gemini CLI, Grok and other ACP agents from the AI tab, with the selected element attached.
sidebar:
  order: 7
---

The **AI** tab, next to Properties and Changes, is a chat with the coding agent already installed on your machine. Feega uses your own subscription and login: it adds no model, key or billing.

It works in the VS Code extension and in `npx feega`.

## Supported agents

Feega talks to agents over the [Agent Client Protocol](https://agentclientprotocol.com). The agent picker lists the ones it finds on your machine; the others appear dimmed under **Not installed** inside the picker, with the command to install them.

| Agent | Started as |
| --- | --- |
| Claude Code | `npx @agentclientprotocol/claude-agent-acp` (adapter) |
| Codex | `npx @agentclientprotocol/codex-acp` (adapter) |
| OpenCode | `opencode acp` |
| Gemini CLI | `gemini --acp` |
| Grok | `grok agent stdio` |
| Cursor Agent | `cursor-agent acp` |
| GitHub Copilot | `copilot --acp` |
| Goose | `goose acp` |
| Qwen Code | `qwen --acp` |

Claude Code and Codex need a small adapter. Feega asks before it runs it with npx, and never earlier.

## Talk to the website

Select an element in the preview, then write. The element is attached to your message as a chip with its file, line and selector, and how widely it is shared. Remove the chip with the **×** to send the message without it.

## What the agent can do

- Replies stream in as the agent writes them, with its plan and tool calls.
- Before a tool that changes something, the agent asks: **Allow** or **Reject**. A file write shows its diff first.
- The picker at the bottom left of the message box sets how much it may do without asking. It lists the modes the agent itself offers (for Claude Code: Default, Accept edits, Plan and so on), and Feega's own choice: **Ask every time**, **Allow edits, ask for commands** or **Allow all**. Each project remembers its choice, and the `feegaInspect.aiPermissions` setting sets the default. **Allow all** is tinted as a warning.
- **Stop** cancels the current turn.
- Files the agent writes land in the **Changes** tab as one change each, marked with the agent's name. [Undo them](/editing/undo-and-changes/) like any other change.

## Chats

Every chat is saved on your machine, per project, with its agent, mode and messages. Close Feega and reopen it: the chats are still there.

The clock icon at the top right of the AI tab opens the list. Each row shows the agent, the first prompt as the title, how long ago it was active, and a green dot while the agent is working. **New chat** starts another one; hover a row to rename or delete it. Deleting asks first.

Chats run in parallel. Switching to another chat does not stop the one that is working. At most four agents run at once; an idle one is parked to make room, and if all four are busy Feega says so.

When you write in an old chat, Feega asks the agent to load its earlier session, if it supports that, so it keeps the context. If not, the history stays visible, a note says "New session — the agent doesn't remember earlier messages", and the agent starts fresh.

Feega signs in to agents that ask for it with the login method they offer (for example Cursor Agent after `agent login`).

The agent runs in your project folder. It can only read and write files inside it.
