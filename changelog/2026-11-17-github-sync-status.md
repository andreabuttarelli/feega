# GitHub sync: links at import, live status in the frame header

**Before.** #2274 built the write path (`code-push/`) and `frame_code_links`, but nothing created a
link: every frame answered `not_linked`, and the 7 header states sat behind `sourceSync = false`.

**Now.**
- `importRoutesInto` takes an `ImportLinker` port; `frames-runtime.importLinker` implements it, so
  `code-import` keeps not depending on `code-push` (it would be a cycle through `code-sync`).
- `import-link.ts`: entry = first landed route's file, files = every landed route file, route
  params read from the landed path, app root from route discovery. GitHub keeps the imported SHA;
  a folder asks the git host (its content hash is not a commit).
- Local adapter `defaultBranch` without `origin` returned `main` blindly; now the checked-out branch.
- Client polls `GET github/push?nodeId=` on load and every 60 s for frames whose `data.code.kind`
  is `github` or `folder`; `sourceSync` is on.

**Deferred.** Popover, Changes panel, explicit Update/pull with split view, "Make variant of",
main/instance push rules, component links, full module import graph (files are route files only),
property-level 3-way merge. Until `20261117120000_frame_code_links.sql` is applied, the link is
dropped and no icon shows.
