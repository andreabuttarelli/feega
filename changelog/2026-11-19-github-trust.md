# What Feega does to a repo, made visible and enforced

- `onlyWip` in `git-host.ts`: `setRef` (the one forced write) refuses any ref outside
  `refs/feega/wip/`, on GitHub and local hosts; covered by the host contract.
- Commit trailers: `Co-authored-by: Feega <hi@feega.app>` and `Feega-Canvas: <url>`; author stays
  the user (Composio account or local git identity).
- `history.ts`: commit diff, forward revert (conflict when later commits touched the same
  files), branch diff vs base. `…/push/history`, `feega github history`, `github_history`.
- Panel: trust note on the branch choice, commit diffs with Revert, branch diff before a PR;
  top bar: autosave stop/resume; the frame header git button no longer selects the frame.

Not in this change: GitHub mark with state badge in the frame header (header icons are GPU
contours of one icon each; a composite needs renderer work), the canvas-wide read-only version
switch, and the popover / ref picker / version compare redesign.
