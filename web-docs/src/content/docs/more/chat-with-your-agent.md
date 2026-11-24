---
title: Chat with your coding agent
description: Talk to Claude Code, Codex, OpenCode, Gemini CLI, Grok and other ACP agents from the AI tab, with the selected element attached.
sidebar:
  order: 7
---

The **AI** tab, next to Properties and Changes, is a chat with the coding agent already installed on your machine. Feega uses your own subscription and login: it adds no model, key or billing.

It works in the VS Code extension and in `npx feega`.

## Supported agents

Feega talks to agents over the [Agent Client Protocol](https://agentclientprotocol.com). The agent picker lists the ones it finds on your machine; the others appear under **Not installed** with the command to install them.

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
- **Stop** cancels the current turn.
- Files the agent writes land in the **Changes** tab as one change each, marked with the agent's name. [Undo them](/editing/undo-and-changes/) like any other change.

The agent runs in your project folder. It can only read and write files inside it.
