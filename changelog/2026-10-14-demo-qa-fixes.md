# Paid clips recorded before submit; coach respects the tour cutoff; busy-DB saves

**Lost paid video.** `submitAndTrackVideoRender` submitted to the provider first and inserted
`video_renders` after; a statement timeout on that insert left a billed task nobody collected.
Now a row is reserved first (`task_id = pending:<uuid>`, no schema change), the provider is
called only if that insert landed, and the real task id is written with retries (250ms/1s/3s).
The reconciler skips `pending:` rows and expires them after the max age. Discarded: a new
status value (needs a migration deploys don't run).

**Tour overlay.** The canvas coach read `profiles.onboarding_status`; the slideshow tour reads
`onboarding_seen_at` and treats accounts older than `TOUR_LAUNCHED_AT` as seen. The coach
ignored that cutoff, so pre-launch accounts got "STEP 1 OF 3" on every empty canvas. Both now
share `predatesOnboarding`.

**"The canvas refused this change."** Was the catch-all for any 4xx, including a generation
refused because its DB write timed out. Statement timeouts (57014) now map to `db_busy`
(`handleError`) and a precise "database was busy" banner; node writes retry once.
