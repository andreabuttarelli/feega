# GitHub sync: Update moves the link forward

**Before.** After a successful Update (`code-import/[nodeId]/pull`) the link kept its old
`baseSha`, so the frame stayed "newer upstream" forever.

**Now.** The pull route calls `frameRebased`: `baseSha` becomes the head of `baseBranch`, read
from the git host (a folder's pull sha is a content hash, not a commit). Failure to rebase never
fails the pull.
