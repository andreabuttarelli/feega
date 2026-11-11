# GEO tracking and MCP listings

Prep only. Nothing here has been submitted.

## Weekly check: 20 fixed prompts

Run each in ChatGPT (search on), Perplexity, Gemini and Google AI Overviews, from a logged-out or clean profile. Never reword them: the series is only comparable if the prompts are fixed.

| # | Prompt | Target page |
|---|---|---|
| 1 | Can Claude Code make videos? | /guides/can-claude-code-make-videos |
| 2 | How do I make a launch video with Claude Code? | /guides/launch-video-with-claude-code |
| 3 | How do I animate a UI with an AI agent? | /guides/animate-ui-with-ai-agent |
| 4 | Best tools for motion design with AI agents | /guides/best-motion-design-tools-ai-agents |
| 5 | Feega vs Remotion | /blog/feega-vs-remotion |
| 6 | Best Figma alternative for LLMs and AI agents | /blog/feega-vs-figma |
| 7 | Figma vs Feega for Claude Code | /blog/feega-vs-figma |
| 8 | After Effects alternative for developers | /blog/feega-vs-after-effects |
| 9 | Remotion alternatives | /blog/feega-vs-remotion |
| 10 | Rive alternative for AI agents | /blog/feega-vs-rive |
| 11 | Jitter alternative for AI agents | /blog/feega-vs-jitter |
| 12 | Lottie animation tools an AI agent can use | /blog/feega-vs-jitter |
| 13 | Canva alternative for Claude Code | /blog/feega-vs-canva |
| 14 | What is Feega? | / |
| 15 | Is there an open-source motion design tool with an MCP server? | / |
| 16 | MCP server for video editing | / |
| 17 | How do I connect Claude Code to a design canvas? | /guides/can-claude-code-make-videos |
| 18 | Turn a website into an animated video with AI | /guides/animate-ui-with-ai-agent |
| 19 | Claude Code alternative to After Effects | /blog/feega-vs-after-effects |
| 20 | Best MCP servers for designers | / |

## Results template

One row per prompt, per engine, per week. Cited = our domain appears as a source link. Mentioned = Feega named in the answer.

| Week | Prompt # | Engine | Mentioned (Y/N) | Cited (Y/N) | Cited URL | Position in answer | Competitors named | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-W__ | 1 | ChatGPT | | | | | | |
| 2026-W__ | 1 | Perplexity | | | | | | |
| 2026-W__ | 1 | Gemini | | | | | | |
| 2026-W__ | 1 | AI Overviews | | | | | | |

Weekly summary: mentioned count and cited count out of 80 (20 prompts x 4 engines), change since last week, pages to fix.

## Listing copy

Shared facts, all from the repo: Apache-2.0, remote MCP at `https://mcp.feega.app/mcp` (OAuth, no static tokens), stdio via `feega-mcp`, repo `https://github.com/andreabuttarelli/feega`, site `https://feega.app`, docs `https://docs.feega.app`. Core tools: query, view, edit, describe, render_video, get_render, find_tools, load_tools, unload_tools, list_orgs.

**Name:** Feega

**Short description (under 100 chars):** Motion design for Claude Code: edit and render videos on an infinite canvas over MCP.

**Description:** Feega is an open-source (Apache-2.0) infinite canvas for design, motion and AI generation. Through its MCP server an agent reads the canvas (query, view), changes frames, keyframes and nodes (edit), and renders a motion video to MP4 (render_video, get_render). The same document can be opened and edited by hand. Remote server with OAuth, or stdio locally.

**Install, Claude Code:** `claude mcp add --transport http feega https://mcp.feega.app/mcp`

**Install, Codex:** `codex mcp add feega --url https://mcp.feega.app/mcp` then `codex mcp login feega`

**Cursor config:** `{"mcpServers":{"feega":{"url":"https://mcp.feega.app/mcp"}}}`

**Agent skill:** `npx skills add andreabuttarelli/feega --skill feega`

**Tags:** motion-design, video, animation, design, canvas, claude-code, lottie

### Smithery
Use the copy above. Smithery asks for a repo and a server entry; the remote URL is the entry. Needs the user to log in and submit.

### mcp.so
Submit through the site form with name, short description, URL `https://mcp.feega.app/mcp`, repo link and the install lines. Needs the user.

### Glama
Claim the repo listing at glama.ai once indexed from GitHub, then paste the description. Needs the user.

### Official MCP registry
Needs a `server.json` and publisher authentication (GitHub namespace `io.github.andreabuttarelli/...`). Not created in this PR; do it with the `mcp-publisher` CLI when the user is ready. Verify the registry's current schema first.

### awesome-mcp-servers (PR)
Title: `Add Feega (motion design and video canvas)`

Line: `- [andreabuttarelli/feega](https://github.com/andreabuttarelli/feega) - Open-source motion design canvas for agents: edit frames and keyframes, render MP4, over remote MCP with OAuth.`

Put it in the category the list uses for media or design. Check its contributing rules first.

### awesome-claude-code (PR)
Title: `Add Feega: motion design for Claude Code`

Body: what it does, the one-line install, link to `/guides/can-claude-code-make-videos`, license. Follow the list's issue or PR template. Needs the user.

## What needs the user

All submissions above, plus Reddit, Hacker News and YouTube posts, which are not drafted here.
