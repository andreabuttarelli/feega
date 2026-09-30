# Consent-gated tracking

**Why.** Legal review (`docs/legal-review-checklist.md`): the Google gtag.js
conversion tag in `app.html` loaded after first interaction or 10 s with no
consent; PostHog ran a "cookieless" tier before any choice; the banner was
region-gated (extra-EU auto-granted); Accept was the prominent button.

**What changed.**
- One table, `TRACKER_CATEGORY` in `src/lib/consent-model.ts`: every tracker
  maps to Analytics (PostHog, Clarity, Seline, Sentry replay) or Marketing
  (Meta Pixel, gtag.js). `blocked(tracker)` in `$lib/analytics` asks it.
- Nothing loads before a choice. `applyConsent` starts only granted trackers.
- Choice stored in first-party cookie `feega_consent` (version, timestamp,
  180 days). `CONSENT_VERSION` bump re-asks everyone.
- Withdrawing a category reloads the page: trackers already running cannot be
  unloaded.
- `app.html` only sets Google Consent Mode v2 defaults (all denied); the tag
  itself is `loadGoogleTag`, marketing only, with a `consent update` first.
- Banner: Accept all / Reject all same style, Customise per category.
  "Cookie settings" in Settings → Profile reopens it.
- PostHog session recording masks inputs and text.

**Discarded.** Region gating (Vercel country header): one rule for everyone is
simpler and never wrong. Anonymous PostHog tier: still a network request
before consent.

**Not covered.** The Framer marketing site needs its own banner (Framer's
built-in cookie banner component). Vercel Web Analytics stays: cookieless,
first-party.
