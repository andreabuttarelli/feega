# Versions of a linked frame

First step of "Compare versions" (spec: `feega-videos/specs/github-sync/decisions.md`): the ref
picker needs branches, tags, open pull requests and the history of one file. The `GitHost` port
gains `listRefs`, `listCommits(ref, { limit, path })` and `listPulls`, held by the shared
contract suite on the GitHub adapter (also self-hosted, via `GITHUB_API_URL`) and on the local
git adapter in both modes. A local folder answers pull requests through its GitHub `origin`
host when there is one, otherwise none.

`frameVersions` reads the link, lists the refs and the commits that touched `entryPath(link)`.
Exposed as `POST /api/v1/projects/:id/github/versions`, `feega github versions` and the MCP op
`github_versions`.

Not yet built: version frames, visual diff, timeline scrubber, restore/variant/code diff, the
header action.
