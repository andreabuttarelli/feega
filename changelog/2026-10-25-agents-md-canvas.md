# AGENTS.md describes the canvas, not the old autopilot

**Before:** `AGENTS.md` described the social media autopilot (posts, SEO, Composio, `feega approve`,
`feega seo`): commands and tables that no longer exist. Codex/Cursor started from it.

**Now:** `AGENTS.md` mirrors `CLAUDE.md` (schema, rules, CLI, evals), names `CLAUDE.md` as source of
truth, and drops Claude-only sections (skills, `docs/agents/*` that don't exist). Every CLI command
was checked against `cli/cli.ts`, every npm script against `package.json`.

**Discarded:** a symlink to `CLAUDE.md`: it would carry Claude-only skill sections.
