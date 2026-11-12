# Code import: images were grey placeholders

Every image on an imported board was grey. The page tree carries each image as an absolute URL on the
app's own dev server (`http://localhost:<port>/...`, or the sandbox URL). `importImage` fetches
server-side with `safeFetchBytes`, which is https-only and refuses private hosts, so every own-origin
image failed and was dropped silently by `imported()` in `url-import/import-url.ts`.

`importBoards` now wraps `importImage` with `ownImages` (`code-import/page-images.ts`): URLs on the
origin of the pages being imported are fetched directly (the guard already vetted that origin) and
handed over as data URLs, which `importImage` already stores as canvas assets. The images live on the
canvas, so they survive the dev server stopping. Everything else (remote absolute URLs) still goes
through the public fetch. Both the Folder path and the GitHub/sandbox path (`importCodeAt`) share it.
