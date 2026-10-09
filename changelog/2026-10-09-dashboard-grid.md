# Dashboard: videos and projects grids

Before: /app listed 8 recent videos, a gallery grid, project chips and a tools row.

Now: the hero (prompt) keeps the first viewport but leaves ~260px so the videos grid peeks, with
a "your videos ↓" cue. Below: a videos grid (2/3/4/5 cols) across all projects, newest first,
paged 20 at a time by an `updated_at` cursor (`GET /app/videos?before=`); one node query, one
batched signing round for posters and one for render previews (`dashboardFor` / `videoPage`).
Cards reuse `PreviewCard` (hover / in-view play) inside a 16:9 well, the poster drawn at its real
format. Projects grid: mosaic of the latest posters (falls back to image thumbs, then the
initial), video count (from a 200-node scan), relative date. The gallery shrinks to one row; the
tools row is dropped (the sidebar already lists tools).

Screenshots: `tests/e2e/dashboard.spec.ts` (`@real`, `DASHBOARD_SHOTS_DIR`).
