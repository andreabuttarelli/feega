# GitHub push: the backend write path

Before, `code_publish` opened a PR through the contents API, one commit per file, with no typed
errors. Now `src/lib/server/code-push/` holds the write path the GitHub sync decisions asked for:

- `git-host.ts` is the port; `github-host.ts` the adapter over the existing Composio `GithubCall`.
  One tree + commit; the ref is created or fast-forwarded only after the commit exists, so a token
  revoked mid-push leaves no branch. `GitError` carries `branch_gone`, `diverged`, `unauthorized`,
  `forbidden`, `not_found`, `unexpected`. `git-host.contract.ts` is the suite any host must pass;
  `fake-github.testkit.ts` runs it in memory.
- `push.ts`: `feega/<name>`, one PR per merge cycle (`-2`, `-3` after a merge or close), a `-sync`
  fallback when the branch was force-pushed, deleted or protected, never forced. Secret scan,
  `.env*` refused, config/lockfiles/dotfiles behind `confirmSensitive`, a soft lock per branch
  (`busy`), co-authors. Undo is a forward commit restoring only the touched files.
- `link.ts`: the frame↔entry link (repo, app root, page or component main/instance, route params,
  base sha, push state) and `linkStatus`, the computed state with the decided priority. Upstream
  renames are followed. Stored in `frame_code_links`, locks in `git_push_locks`
  (`20261117120000_frame_code_links.sql`, not applied: both stores degrade to "no link"/"no lock").

Three adapters behind the same port and contract suite: `github-host.ts` (Composio-connected
GitHub App, or `GITHUB_PUSH_TOKEN` + `GITHUB_API_URL` for self-hosted/Enterprise, picked in
`hosts.ts`), and `local-git-host.ts` for folder imports (desktop, local dev): git plumbing with a
private index (`git-cli.ts`), so the user's branch, worktree and history are never touched; pushes
to `origin` without force, PRs only when a GitHub token exists (`pull_unavailable` otherwise).
Plumbing instead of a separate `git worktree`: same isolation, nothing checked out on disk.

Not here: creating links at import time, webhooks (status is polled), 3-way merge, fork PRs,
images in PR bodies. `code_publish` is unchanged.
