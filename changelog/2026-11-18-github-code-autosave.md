# GitHub-linked frames autosave code to a draft pull request

Before: a GitHub-linked frame wrote code only on a manual Push from Changes. Local folders already
wrote live; GitHub did not.

- `src/lib/canvas/code-autosave.ts`: a debounced batcher (3 s idle, one save in flight, conflict
  and paused stop it until resumed). GpuFlow touches it when the `data` of a linked frame changes,
  i.e. after the optimistic write landed, so it rides the existing save path instead of a new one.
  Not a REGISTRY row: the git commit is downstream of the node write, not a canvas action.
- `pushFiles` gained `pull: draft` (opens the PR as draft), `branch` (exact name instead of
  `feega/<name>`) and `target: base` (commit straight to the base branch, no PR; a 403 from
  GitHub is `protected`, never a `-sync` fallback). A session push whose `since` is the base
  branch ignores it, so one direct commit does not turn later pushes into base commits.
- `GitHost.markReady`: GitHub has no REST call for it, so it uses the GraphQL mutation
  `markPullRequestReadyForReview` with the PR `node_id`. Local hosts delegate to their GitHub
  pulls host or answer `pull_unavailable`.
- `POST …/github/push/ready`, `feega github ready`, MCP `github_ready`; `feega github push`
  takes `--branch`, `--direct`, `--draft`.
- Top bar: `GitStatus.svelte` is portalled into `[data-top-git]` of `CanvasTopBar` (same pattern
  as peers): repo, branch, upstream files, autosave state, PR + CI, Ready for review, Versions
  (opens the existing ref picker). Branch options live in the existing Changes panel.

Assumption to verify on a real repo: GitHub answers 403 on a ref PATCH to a protected branch.
It may answer 422, which today maps to `diverged`.

Not done: switching the frame to another branch from the top bar (Versions compares; Pull with a
branch in RepoSync still switches).
