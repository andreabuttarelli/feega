# Docs and demo videos for the home prompt, landing handoff, folder upload, agent card

Four features shipped without a docs page or a video: the home prompt (kinds, GitHub / folder /
Figma sources, attachments), the feega.app hero prompt that survives sign-in, the one-time folder
upload on the web, and the **connect your agent** card.

- New page `getting-started/start-from-a-prompt.mdx` holds the home prompt and the landing
  handoff; `first-canvas.md` links to it instead of repeating it.
- `first-canvas.md` said free plans run Haiku for 20 messages. `agent-plan.ts` runs Opus 5.5 on
  every plan; the line is gone.
- Videos in `import-from-code.mdx` (folder) and `mcp.mdx` (agent card).
- Demos `home-prompt`, `landing-handoff`, `folder-upload`, `connect-agent` in
  `scripts/demo-record/demos/`. The agent POST is held open by `holdAgent`, so no model is called;
  each demo drops the project the send created. `fixtures/ember-and-rain/` is the folder uploaded.
