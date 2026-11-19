# GitHub-linked frames: chosen working branch, autosave, summary commits

Before: a GitHub-linked frame wrote code only on a manual Push to `feega/<name>` with a PR.

Model after review (three concepts, no branch imposed):

- **Working branch.** Nothing is written until the user picks where edits go (existing branch,
  main included, or a new one from a base). Stored as `workBranch` on every link of the canvas'
  frames; `frameCheckout` / `POST …/github/push/branch` / `github_branch`. Edits made before the
  choice stay on the canvas: autosave answers `no_branch`, keeps the batch and flushes it on
  `resume()` after the choice.
- **Autosave** writes the code to `refs/feega/wip/<branch>` (`saveWip`), a private ref replaced
  with `force` on each save (parent = branch head). Why a ref and not amending a WIP commit on the
  branch: GitHub only rewrites a branch with a force update, and this feature never force-pushes
  a branch people share. The branch itself does not move between commits.
- **Commits are summaries.** `gitSession` (`git-session.svelte.ts`) commits after 2 min idle or
  10 min after the first unsaved save (`commitDue`), and on `pagehide` (keepalive fetch). The
  message is deterministic: `Update <frame> and <frame>` (two names, then "and N more") plus the
  changed files (`commitSummary`). `canvas-op-summaries.ts` was not used: it describes MCP ops,
  while canvas edits reach code as file diffs, not ops. The optional AI summary was not built
  (no model calls in this PR).
- **Commit on a chosen branch** (`commitWorking`): no `-sync` fallback; someone else's commit on
  another file is kept, on the same file it answers `conflict` (via `changedSince`); 403 is
  `protected`. Without a chosen branch the old `feega/<name>` + PR path stays for agents.
- **Pull request** is separate: `openPull` / `…/push/pull` / `github_pull`, draft by default,
  `same_branch` when base equals the working branch. `markReady` uses GitHub GraphQL.
- Removed: `target: "branch"`, `--direct`, the segmented control, panel checkboxes for the next
  commit.

All GitHub calls go through `GithubCall`: the Composio proxy of the connected account
(`githubFor` → `composioLinks`), including `/graphql`. `hosts.ts` still falls back to
`GITHUB_PUSH_TOKEN` when no account is connected (pre-existing, self-hosting); not removed here.

Assumptions to verify live: GitHub answers 403 on a protected-branch ref update (may be 422);
the Composio proxy forwards `POST /graphql` and `refs/feega/...` ref writes.
