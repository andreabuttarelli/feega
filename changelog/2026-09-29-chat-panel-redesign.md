# Chat panel redesign

The project chat (`CanvasChatPanel` → `brand-agent/ChatPanel`) showed plain
text bubbles, three-word tool pips and Italian hardcoded copy. It now renders
what the agent stream actually carries:

- assistant text as sanitised markdown (`renderDocHtml`, the doc node's
  renderer: raw HTML escaped, unsafe links neutralised);
- one row per tool call with status icon, expandable input/result, and a link
  to the canvas when the result carries a node or connection;
- a failure banner that tells a 402 (credits exhausted, links to credits)
  apart from a generic failure (retry);
- scroll-follow that stops when the user scrolls up, with "Jump to latest";
- empty state with four canvas prompts, skeleton while loading;
- mobile: full width, 44px actions, composer lifted over the keyboard via
  `visualViewport`.

Rules live in two tested modules: `chat-follow.ts` (scroll state as a
transition table) and `chat-view.ts` (tool status, canvas links, failures,
speaker grouping, keyboard inset). Copy moved to `chat.panel.*` in `en.json`.

Global `.user` and `* { padding: 0 }` rules leak into scoped components:
message classes are `is-user`/`is-assistant`, list styles are explicit.

Not built, because the server has no support for them yet: thread list / new
thread (one thread per project and user in `openThread`), attachments (POST
takes `message` only), model picker (`llmModelForPicker(null)`), credits spent
per turn (not in the stream), tool calls after reload (only text is saved).
