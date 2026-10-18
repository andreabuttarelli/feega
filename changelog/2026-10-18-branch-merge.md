# Frame branches, step 1: diff and merge

Design in `~/Documents/feega-videos/figma-multiplayer/BRANCHING.md`: a
branch of a frame is a hidden motion node forked at a revision; merge is a
three-way merge of ops back onto the frame.

This step is the pure core, `src/lib/motion/branch-merge.ts`:
- `pathOf(op)`: the unit of conflict, one row per op kind in `PATH`
  (`clip:<id>:<field>[:<key>]`, `exists:clip:<id>`, `order:clip:<id>`,
  `track:…`, `doc:…`) — the same granularity as per-path LWW.
- `branchDiff(base, branch, main)`: both sides' ops and the conflicts —
  the same path changed to different values, or a clip/track deleted on
  one side and edited on the other (`exists:<owner>`).
- `mergeBranch(base, branch, main, choices)`: main plus the branch's ops;
  on a conflict `choices[path]` decides, default main. Choosing the branch
  over a deletion on main brings the edited clip back.

Nothing user-visible yet.
