# Scene references in a parent frame

First step of "scenes → one video". The composition node lays motion
frames out in space, not in time, so it can't sequence scenes; that
direction was dropped.

A parent motion frame now holds scene clips: Precomp clips with
`scene: <nodeId>`. The stored doc keeps only placement; the scene
content stays in its own node. `resolveScenes` (src/lib/motion/scenes.ts)
embeds the scene docs in memory for preview/export, so one edit updates
every placement. `compOf` skips scene clips, so a stored parent validates
without copies of what it references.

Not wired to any UI, export or MCP yet; those come in later PRs.
