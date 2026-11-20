# Feega 0.2.0 for VS Code

The extension ships as **Feega** (`andreabuttarelli.feega`, Open VSX namespace
`AndreaButtarelli`). Every user-visible "Feega Inspect" (panel title, messages, bug-report
template, Feega menu) now reads "Feega". Command and setting ids stay `feegaInspect.*` so
existing settings keep working. `inspect/LICENSE` is the repo's Apache-2.0, required by the
marketplaces.

## Dev server fixes

- **App picker.** On the repo root the planner listed 209 "apps": agent worktrees under
  `.claude/`, test fixtures, build output. `run-plan.ts` now skips `.claude`, `dist`, `build`,
  `.svelte-kit`, `.next`, `.output`, `__fixtures__`, `test/fixtures`, caps depth at 4, and
  counts the root as an app when its own dev script runs a framework (not turbo/nx/lerna/
  `pnpm -r`). Dazero root now lists 7 apps in 56 ms. Workspace globs are not used as a filter:
  `landing/` and `web-docs/` are not in `workspaces` and are real apps. The choice is a
  QuickPick remembered per workspace (`feegaInspect.app:<path>`); "Choose app…" in the server
  menu and the panel switches.
- **Dependencies.** `deps.ts` checks the framework binary in `node_modules/.bin` from the app up
  to the workspace (hoisting). Missing → the plan's install command runs in the install dir,
  panel state Installing with Cancel; failure shows the last line, Show logs and Start (retry).
  Not done: `npx <bin>` fallback when there is no dev script.
- **Readiness.** Ready is the first TCP accept on the port Feega assigned or the URL the server
  printed (`Local:` parsed past ANSI), on 127.0.0.1 and ::1. Before, an HTTP probe with a 2 s
  abort could keep failing during a slow first SSR compile. A failure table in `dev-output.ts`
  (command not found, EADDRINUSE, missing module, SyntaxError) ends the wait at once. Each start
  carries a token, so a stale start can no longer overwrite the state of a newer one.
- **Processes.** Servers and installs spawn in their own process group; stop sends SIGTERM to the
  group, SIGKILL after 3 s. PIDs are kept in workspaceState with the app path; activation kills
  those still running that app. Attached servers are never tracked or killed. Script launches
  (`npm run dev`) don't show the app path in `ps`, so their orphans are only forgotten.
