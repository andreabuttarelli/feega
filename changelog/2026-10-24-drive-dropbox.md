# Google Drive and Dropbox import and export

F4 FL-22. Per-user OAuth (`/api/v1/cloud/[provider]/connect` -> provider -> `/api/v1/cloud/callback`; state sealed with `sealSecret`, 10 min). Tokens sealed in `user_cloud_tokens` (migration PR, not applied by us; the store reads a missing table as not connected, like the Figma one), refreshed on use. Provider differences live in one table (`cloud.ts`): list, download, upload.

- Import: Cloud button in the Design bar -> `CloudPicker` -> `POST /api/v1/projects/:id/cloud/:provider/import` -> `importCanvasBytes` (extracted from `importCanvasLink`) -> asset + node at the view centre.
- Export: Cloud menu in the selection bar for one image/video -> picker (folders) -> `.../export`.
- Needs env `GOOGLE_DRIVE_CLIENT_ID/SECRET`, `DROPBOX_CLIENT_ID/SECRET`; without them the picker says the provider is not set up. Drive scopes drive.readonly + drive.file (restricted scope: Google verification needed).
- Not done: MCP `import_link` accepting Drive/Dropbox links, export node target, Drive shared drives, pagination past 200 entries.
