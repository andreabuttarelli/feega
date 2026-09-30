# Cookie Policy

> **Draft — to be reviewed by a lawyer before publication.**
> Last updated: 30 September 2026

This policy lists the cookies and similar technologies (browser storage, pixels, scripts) that feega uses in the web app, under Art. 122 of Italian Legislative Decree 196/2003 and the Garante's guidelines of 10 June 2021. How we process the related personal data is in the [Privacy Policy](./PRIVACY.md); the providers are listed in [Sub-processors](./SUBPROCESSORS.md).

No tracker runs on development or preview hosts, and none runs for feega staff. Brand blogs hosted by feega load none of the analytics or advertising tools below.

## 1. Strictly necessary

Set without consent: the Service does not work without them.

| Name | Type | Purpose | Duration |
|---|---|---|---|
| `sb-<project>-auth-token` (may be split into `.0`, `.1`) | cookie, first party | keeps you signed in (Supabase Auth session) | [up to 400 days, refreshed while you use the Service — to confirm] |
| `oauth_return` | cookie, first party, HttpOnly | returns you to an MCP/OAuth authorisation after login | 10 minutes |
| `dz-last-project` | cookie, first party | reopens the last project you worked on | 1 year |
| `sidebar_state` | cookie, first party | remembers whether the sidebar is open, so the page renders correctly on load | 1 year |
| `feega_cookie_consent_v1` | localStorage | stores your cookie choice | until you clear it |
| `theme` | localStorage | light or dark theme | until you clear it |
| `feega.sidebarOpen`, `feega.sidebarPanePx`, `feega.sidebarPane`, `feega.chatPanelPx`, `feega.chatOpen`, `feega.chatTab` | localStorage | layout of sidebar and chat panel | until you clear them |
| `feega:brands-panel-open:<project>` | localStorage | which brands are expanded in a project | until you clear it |
| `feega.warningsSeen.<brand>` | localStorage | which brand warnings you have already seen | until you clear it |
| `feega:brand-wizard:<project>` | sessionStorage | draft of the brand setup wizard | until the tab is closed |

Older `dazero…` keys with the same purposes may still be read and are no longer written.

## 2. Analytics without consent (anonymous)

| Tool | What it does | Storage |
|---|---|---|
| PostHog (EU cloud), cookieless mode | aggregate page views and clicks, no session recording | memory only, nothing stored on your device |
| Vercel Web Analytics | aggregate page views | no cookies |
| Seline | page views | no cookies until you sign in (see §5) |

## 3. Analytics with consent

| Tool | Name | Purpose | Duration |
|---|---|---|---|
| PostHog | `ph_<key>_posthog` cookie and localStorage | recognises returning visitors, product analytics, session recording | 1 year [to confirm] |
| Microsoft Clarity | `_clck`, `_clsk`, `CLID` and related | session replay and heatmaps | `_clck` 1 year, `_clsk` 1 day, `CLID` 1 year |

## 4. Marketing (advertising measurement)

| Tool | Name | Purpose | Duration |
|---|---|---|---|
| Meta Pixel | `_fbp`, `_fbc` | measures which Meta ads lead to sign-ups, purchases and booked calls | 90 days |
| Google gtag.js conversion tag | `_gcl_au` and related | measures which Google ad clicks lead to conversions | 90 days |

## 5. Consent

**Intended behaviour.** Visitors from the EEA, the United Kingdom and Switzerland, and visitors whose country is unknown, see a banner with equal **Accept** and **Reject** buttons before any non-essential cookie is set. Until they accept, only §1 and §2 run. Accepting enables §3 and §4; rejecting keeps them off. Visitors from other countries are not shown the banner and analytics are enabled. The choice is stored in `feega_cookie_consent_v1` and can be changed at any time via "Cookie preferences".

**Current state of the code (being fixed).** As of the date above the code does not yet fully match that behaviour:

- the Google gtag.js conversion tag loads after the first interaction or 10 seconds, without waiting for consent;
- the Meta Pixel loads the same way (immediately after a Meta ad click), and the server sets `_fbc`/`_fbp` on arrival from a Meta ad, without consent;
- when you sign in, Seline sets a cookie linked to your user ID and PostHog receives your user ID and email, without consent;
- there is no "Cookie preferences" link yet to reopen the banner.

These are tracked in the [legal review checklist](./docs/legal-review-checklist.md) and must be fixed before publication.

## 6. Managing cookies

Besides the banner, you can delete or block cookies in your browser settings. Blocking strictly necessary cookies prevents you from signing in.

## 7. The marketing website

The marketing site is built with Framer, which may set its own cookies. [FRAMER SITE COOKIES — to list].

## 8. Changes

We update this page and the date above when the list changes.

---

Questions: [privacy@feega.app](mailto:privacy@feega.app)
