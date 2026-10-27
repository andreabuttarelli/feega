---
title: Architecture overview
description: How feega is built, for contributors.
sidebar:
  order: 0
---

- App: SvelteKit in `src/`. REST API under `src/routes/api/v1/`.
- Marketing site: a separate SvelteKit project in `landing/` (home, landing pages, legal, changelog), deployed as its own Vercel project on feega.app. The app 301s those paths there (`src/lib/marketing.ts`) and its `/` goes to the dashboard or `/login`.
- CLI and MCP server: `cli/`, thin HTTP clients of the API.
- Packages in `packages/`: `api-contracts`, `gpu-core`, `gpu-text`, `shader-fx`, `feega-motion-react`, `site-analysis`. A package never imports the app (`packages/no-app-imports.test.ts`).
- Database: Supabase Postgres with row-level security. See [Data model](/architecture/data-model/).
- Canvas drawing: a display list drawn by the GPU core ([ADR 0020](/architecture/adr/0020-the-infinite-canvas-is-a-display-list-drawn-by-the-core/), [ADR 0019](/architecture/adr/0019-a-full-gpu-renderer-reads-the-doc-not-the-page/)).
- All decisions: [Decision records](/architecture/adr/).

## Rules for code

From `CLAUDE.md`: dependencies point inward; the failing test comes first; reorder and change behaviour in separate commits; no cyclic dependencies; every change a user can notice updates two changelogs; PRs target `dev`. Also [Lessons](/architecture/lessons/).

:::caution
`CONTEXT.md` at the repo root is a glossary of an earlier product (agent teams, threads, brand memory). It does not describe the canvas and is not reproduced here.
:::
