# Legal links on sign-in, plus a shared table and terms acceptance

**Why.** Nothing on the login/signup page pointed to the legal pages, and
account creation recorded no acceptance of anything. `profiles` had no column
for it either.

**What changed.**
- `src/lib/legal-links.ts`: one table, `LEGAL_LINKS`, keyed by page
  (`terms`, `privacy`, `cookies`, `acceptableUse`, `refunds`,
  `aiTransparency`, `dpa`, `subprocessors`, `legalNotice`), base URL
  `https://feega.app`, plus `CURRENT_TERMS_VERSION` and an ordered
  `FOOTER_LEGAL_LINKS` for the footer/menu set. Every legal link in the app
  goes through `legalHref(key)` — no URL is written twice.
- `src/routes/login/+page.svelte`: a small muted notice below the form
  (signin/signup) linking Terms, Acceptable Use, Privacy, Cookies, plus the
  full `LegalFooter` underneath. Links open in a new tab (`noopener`).
- `src/lib/components/LegalFooter.svelte`: the reusable full-set footer, now
  also on the project settings index, the billing page and the `/s/[token]`
  share viewer.
- `src/lib/components/canvas/CanvasMenu.svelte`: a "Legal" sub-menu under
  Help in the burger menu (desktop + mobile — same component renders both).
- `profiles.terms_accepted_at` / `profiles.terms_version` (migration
  `20260930100000_profiles_terms_acceptance.sql`, additive). Written once, in
  `landingPath` (`src/lib/server/tenancy/landing.ts`), right after
  `ensureProfile` — covers email/password signup, OAuth, and invite accept,
  since they all converge there. `recordTermsAcceptance` in
  `src/lib/server/repos/profiles.ts` only writes when the profile has never
  accepted.
- Version bump path: `src/lib/terms-notice.ts` decides when a signed-in
  profile's `terms_version` is behind `CURRENT_TERMS_VERSION`; the root
  `+layout.server.ts` reads it, `TermsUpdateNotice.svelte` shows a small
  non-blocking corner notice ("We updated our Terms — Review"), and dismissing
  it (or clicking the link) posts to `POST /api/terms-accept`, which records
  the current version. Never blocks navigation.

**Unchanged.** The cookie-consent banner and its storage
(`src/lib/consent.ts`, `CookieBanner.svelte`) — a concurrent change owns that
surface. `oauth/authorize` and `cli/callback` don't create accounts (they
require an existing session), so they don't need their own acceptance write.

**Verified end to end.** A real signup through `/login` (browser, dev server,
disposable user, teardown in `finally`) landed `terms_accepted_at` and
`terms_version` on `profiles`. Screenshots at 1440 and 390 confirm the notice
and footer render, wrap, and stay muted/square on both sizes.

**Discarded.** Threading acceptance through every OAuth/invite call site
individually — `landingPath` is the one place all of them already converge on
`ensureProfile`, so recording there is one call, not three.
