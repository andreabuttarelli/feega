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
| `feega_consent` | cookie, first party | stores your cookie choice, the policy version and when you chose | 180 days |
| `theme` | localStorage | light or dark theme | until you clear it |
| `feega.sidebarOpen`, `feega.sidebarPanePx`, `feega.sidebarPane`, `feega.chatPanelPx`, `feega.chatOpen`, `feega.chatTab` | localStorage | layout of sidebar and chat panel | until you clear them |
| `feega:brands-panel-open:<project>` | localStorage | which brands are expanded in a project | until you clear it |
| `feega.warningsSeen.<brand>` | localStorage | which brand warnings you have already seen | until you clear it |
| `feega:brand-wizard:<project>` | sessionStorage | draft of the brand setup wizard | until the tab is closed |

Older `dazero…` keys with the same purposes may still be read and are no longer written.

## 2. Cookieless statistics

| Tool | What it does | Storage |
|---|---|---|
| Vercel Web Analytics | aggregate page views | no cookies |

## 3. Analytics with consent

| Tool | Name | Purpose | Duration |
|---|---|---|---|
| PostHog | `ph_<key>_posthog` cookie and localStorage | recognises returning visitors, product analytics, session recording | 1 year [to confirm] |
| Microsoft Clarity | `_clck`, `_clsk`, `CLID` and related | session replay and heatmaps | `_clck` 1 year, `_clsk` 1 day, `CLID` 1 year |
| Seline | cookie linked to your user ID after sign-in | page views | [to confirm] |
| Sentry session replay | none | replay of an error, all text, inputs and media masked | — |

## 4. Marketing (advertising measurement)

| Tool | Name | Purpose | Duration |
|---|---|---|---|
| Meta Pixel | `_fbp`, `_fbc` | measures which Meta ads lead to sign-ups, purchases and booked calls | 90 days |
| Google gtag.js conversion tag | `_gcl_au` and related | measures which Google ad clicks lead to conversions | 90 days |

## 5. Consent

Every visitor sees a banner with **Accept all**, **Reject all** (same size and style) and **Customise** (Analytics and Marketing separately) before any non-essential script loads. Until you choose, only §1 and §2 run; nothing from §3 or §4 makes a network request. Google Consent Mode v2 starts with every signal denied. The choice is stored in `feega_consent` with the policy version and a timestamp; when the policy version changes, we ask again. Change it any time via "Cookie settings" in Settings → Profile; withdrawing a category reloads the page so its tools stop.

## 6. Managing cookies

Besides the banner, you can delete or block cookies in your browser settings. Blocking strictly necessary cookies prevents you from signing in.

## 7. The marketing website

The marketing site is built with Framer, which may set its own cookies. [FRAMER SITE COOKIES — to list].

## 8. Changes

We update this page and the date above when the list changes.

---

Questions: [privacy@feega.app](mailto:privacy@feega.app)
