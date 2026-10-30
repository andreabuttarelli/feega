# History 6: frame branches as lanes; Branches… retired (#1552)

Spec `docs/specs/history-panel.md`, ADR 0024.

- `SOURCE_ACTIONS` gives branch entries Merge and Drop; `branchForks` links
  each branch row to the next older revision of its frame, drawn as a dashed
  fork off that lane.
- `history-actions.ts`: one `actAt` over a per-source write table replaces
  `restoreTo`/`nameAt`; `mergeFork` answers `conflict` with the paths until a
  `keep` side (branch|main) is given, then `mergeBranchBack`; `dropFork` →
  `dropBranch`.
- Entry points: panel row Merge/Drop/Keep, New branch button (One frame) →
  editor page action `createBranch`; ops `merge_branch_at`, `drop_branch_at`;
  `POST /api/v1/canvas/{id}/history/{entryId}/merge|drop`;
  `feega history <canvasId> --merge|--drop <entryId> [--keep]`. A frame's
  branches are listed by `feega history <canvasId> --frame <frameId>` (no
  separate `branches` subcommand).
- Removed: frame action "Branches…", `FrameDialog.Branches`,
  `BranchesMenu.svelte`, editor page actions `branches`, `reviewBranch`,
  `mergeBranch`, `dropBranch`. Editor ops `*_branch` stay for MCP
  `motion_editor_op`.
- No migration.
