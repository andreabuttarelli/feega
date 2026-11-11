# Local folder import works in the cloud

**Before:** the Local folder source called the folder importer with a disk path on the app server. On feega.app that path never exists, and the browser picker only gives a name, so the chip asked for a path that could not work.

**Now:** outside local mode the browser reads the picked folder (`showDirectoryPicker`, `<input webkitdirectory>` fallback), skips `node_modules`, `.git`, build output, `.gitignore` matches and files over 1 MB, refuses over 25 MB or 4,000 files, and packs a tar.gz (`src/lib/code-upload/`). It is PUT to a signed URL in `canvas-assets` at `${orgId}/${projectId}/code-uploads/<uuid>/<name>` (`POST /api/v1/projects/:id/code-uploads`). The import (`upload` on `code-import`, `PromptSource.Upload` on the home prompt) downloads it through the user's RLS client and hands it to `importRepoAt`, the same Vercel Sandbox runner a GitHub repo uses with its private-repo tarball. Uploaded code never runs on the app server.

The frame records `code.kind = 'upload'` with the snapshot's sha1: `uploadSource` reads files from the tarball, `head` is constant (pull is always up to date), `publish` is null (`no_sync`). Code mode says "imported once, no sync" and keeps only the patch download.

**Discarded:** a zip uploaded through the API (Vercel's 4.5 MB body cap); running the snapshot locally on the server like the folder path (untrusted code on the app server). Local mode keeps the live path source.
