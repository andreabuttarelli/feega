# Frame sources batch: no per-frame reads left

Heads come from `latestHeads` (versions in one query, docs in one), so a
node whose `docHeadRevision` lags its head is served in the batch instead
of falling back to the single route. Linked mains resolve across all
frames of the batch per depth level (`linkedHeads`), not per frame.
