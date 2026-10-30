# Hot models in the + menu

New "Models" section in the insert menu and the phone Insert sheet.

- `hot-models.ts`: one table (model id, label, logo key). Tiles show only
  ids the runtime catalogue offers; a test checks every id exists in the
  static specs or the Wiro catalogue fixture.
- Click or drag creates a node with `model` already set, through the
  existing filled-node path (`FilledNodeDrag` gains `model3d`).
- `ProviderIcon` gets a size, an OpenAI mark and Kuaishou/MiniMax.
- Discarded: a `hot` flag on the DB catalogue rows (needs a migration for
  a list that changes by editing one file); audio tiles (no verified id);
  Kling 4.0 (not in any catalogue yet).
