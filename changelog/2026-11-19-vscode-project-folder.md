# VS Code extension opens the folder as the project, with git

Reported: Feega opened from the extension did not see the repo's git.

Causes:
1. The extension ran `npx -y feega@latest`: the last npm release, never the repo's code.
2. It opened `<folder>/<folder>.feega` and offered to gitignore `*.feega`, against ADR 0041
   (the project is the `.feega/` folder, versioned).
3. The git group (#2403) lit up only for frames imported from a folder.

Changes:
- `feega.openProject` opens the workspace folder; `feega.importFolder` imports into it. A legacy
  `<folder>.feega` is renamed to `.feega`, which `openFolder` (#2409) migrates. `feega.newCanvas`
  and the gitignore offer are removed.
- `feega.devServerPath`: spawn `node <clone>/scripts/local.mjs <folder> --port=N`
  (`launcherOf` in `vscode/canvas-run.js`). No `--import` there: `local.mjs` has none.
- Project git: `src/lib/server/local/project-git.ts` + `GET/POST /local/git` (commit only
  `.feega/`, push `origin HEAD`, PR). `ProjectGit.svelte` portals into the top bar's git slot in
  local mode.

PR: push with the user's git credentials, then GitHub's compare page. No token, no API call:
integrations go through Composio only, and Composio is not reachable in local mode.
