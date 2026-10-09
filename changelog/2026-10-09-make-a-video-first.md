# Make a video, first thing

Decision: the motion editor comes before projects. `/app` is one input, and new and returning
users see the same screen (the first-run "paste your URL" variant is gone).

- `briefKind`/`briefMessage` (`src/lib/motion/video-brief.ts`): a bare URL (with or without
  scheme) becomes `Make a launch film of <url>`, which the motion prompt's trailer recipe
  answers with `analyze_site` then `write_script`; any other text travels as typed and lands on
  the brief path. The `video` action in `src/routes/app/+page.server.ts` applies it before the
  redirect, so the editor's existing `?brief=` auto-send starts the turn.
- Dashboard order: input, recent videos, gallery, projects, tools. Projects are a quiet list
  at the bottom; the sidebar keeps them too.
- Sidebar: `new-video` row first, pointing at `/app#video-brief` (the autofocused input).
- Unchanged and relied on: first run already lands on `/app` (`ARRIVAL_LANDING`), terms are
  recorded at signup (`recordFirstAcceptance`), `startMotion` reuses the default project and
  Motion canvas, the editor opens the chat column (desktop) or the sheet at Half (mobile).

Discarded: classifying URLs server-side in the agent. The message is visible in the chat, so
the user sees what was asked.
