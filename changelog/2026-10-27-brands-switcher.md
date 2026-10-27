# Brands panel: a switcher for agencies

**Before.** `ProjectDragPanel` served Assets and Brands. Brands were a flat accordion of
every org brand, with no search, no order beyond A–Z, and no sign of a brand's health.

**Now.**

- `BrandsPanel` (container) + `BrandSwitcher` (search, sections, pins) + `BrandKit` (the
  existing draggable pieces). `ProjectDragPanel` is assets only.
- `brand-switcher.ts`: one table for health (`reconnect` > `unconnected` > `scheduled` >
  `idle`), section order (pinned, project, all), and the per-brand tally.
- `GET agent/brands` adds `scheduled`, `accounts`, `accountsDown` and `projectBrandId`.
  "Scheduled" = `posts.status = 'ready'` with `planned_for` in the future: Zernio holds the
  real schedule (`scheduled_posts` was dropped on 2026-09-22).
- `getBrandsList` carries the same counts; `feega brands` prints them.
- Pins live in localStorage for now; phase 3 moves them to the database.

Phase 2 (tabs) and phase 3 (schema) follow in separate PRs.
