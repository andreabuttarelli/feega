# How feega works: first-login tour

**Before.** Nothing explained why "new video" also creates a canvas project. Users saw two
products (motion, canvas) and no link between them.

**Now.** `HowFeegaWorks.svelte`, mounted in the root layout on `/app/*` and `/p/*` for signed-in
users: six slides (feega, motion, canvas, the link, wiring, start), SVG/CSS illustrations of the
real UI, ←/→/Esc, circle dots, centered dialog on desktop, full screen at ≤640px. Reduced motion
stops the animations. Reopened from the sidebar entry `How feega works` (`NavKind.Tour`).

**State.** `profiles.onboarding_seen_at` (migration `20261010180000_onboarding_seen.sql`, which
also backfills every existing profile as seen). Rule in `tourStateOf`: created before
`TOUR_LAUNCHED_AT` → seen; seen_at set → seen; null → due. Column missing (42703/PGRST204) →
`unknown`, logged, and the browser decides via localStorage `feega:tour-seen`; the close POST
(`/api/onboarding-tour`) answers `{ saved: false }` and the client writes localStorage.

**Analytics.** PostHog via `track`: `tour_slide_viewed`, `tour_skipped`, `tour_finished`.

**E2E.** `signInE2e` pre-marks the tour seen in localStorage (and the fixture sets the column) so
other specs are not blocked by the dialog; `tour.spec.ts` opts out with `E2eTour.Due`.

**Discarded.** Real motion embeds in the slides: one player per slide is heavy for a first load.
User metadata instead of a column: not queryable, and written by auth, not by RLS on profiles.
