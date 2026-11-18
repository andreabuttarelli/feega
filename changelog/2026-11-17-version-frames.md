# Read-only version frames

Step (a) of Compare versions. `frameCompare` resolves each ref to a sha (a branch or tag through
`listCommits(ref, {limit: 1})`, `#12`/`pull/12` through the pull's head sha) and imports the
link's route at that sha beside the original, one frame width plus a gap per version. Importing
at a sha, not at the ref name, keeps a version stable when the branch moves.

The frame carries `data.version` (`of`, `ref`, `label`, `sha`, `entry`), is renamed to the
label, and its tracks are locked. It is never linked: no `frame_code_links` row and no
`data.code`, so push, status and the source poll ignore it. The header shows the new
`FrameBadge.Version` row (git icon) and hides any GitHub state.

GitHub imports through the existing tree URL at the sha. A local folder is checked out with
`git worktree add --detach` under the OS temp dir, keyed on the folder and sha, with
`node_modules` symlinked: the user's branch and work stay untouched.

Also fixed: in local origin mode a tag's history failed, because refs resolved only as branches;
they now fall back to `refs/tags`.

Exposed as `POST /api/v1/projects/:id/github/compare`, `feega github compare` and MCP
`github_compare`.
