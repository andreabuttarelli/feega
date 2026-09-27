# Ads rebuild — audit (phase 1)

## What exists today, and why it's broken

All ads code targets the **old** single-brand schema. Live schema (`src/lib/database.types.ts`)
has moved on; `node scripts/schema-drift-check.mjs` confirms the gap directly:

```
ad_campaigns → '*,zernio_ad_accounts(*),posts(...)'
  → CORREGGI IL CODICE — Could not find a relationship between 'ad_campaigns' and 'zernio_ad_accounts'
```

| Module | Lines | Reads/writes | Status on live schema |
|---|---|---|---|
| `src/lib/server/ads.ts` | 1725 | `zernio_ad_accounts`, `ad_campaigns.zernio_*`, `brands.plan/status/zernio_profile_id`, `posts.brand_id` + old cols | **Broken.** `zernio_ad_accounts` doesn't exist (live table is `ad_accounts`, different columns — no `zernio_ad_account_id`-only shape, has `platform`/`status`/`facebook_page_id` etc). `brands` has none of `plan`, `status`, `zernio_profile_id` (confirmed: live `brands` = `id,org_id,name,slug,website,logo_url,short_description,content`). |
| `src/lib/server/ads-actions.ts` | 429 | loader/actions for `/ads/{social,google}`, selects `brands.plan, status, ads_settings, zernio_profile_id` | **Broken**, same reason. Route never renders real data — `brand.plan`/`ads_settings` are `undefined`, gates always fail closed. |
| `src/lib/server/ads-remix.ts` | 606 | creative remix from post media, `ad_creatives`, `posts` | Partly reusable: the remix/creative-variant *logic* (prompt building, media selection) doesn't touch brand plan columns as heavily — needs a full read before reuse, not audited line-by-line here (phase 3). |
| `src/lib/server/ads-fatigue.ts` | 332 | reads metrics history to diagnose creative fatigue | Logic layer, mostly schema-agnostic once fed real metric rows — reusable in phase 4. |
| `src/lib/server/ads-generate.ts` | 182 | drafts a campaign (objective/budget/targeting) from a post | Reusable logic, needs new table names wired in phase 3. |
| `src/lib/server/ads-credits.ts` | 96 | credit ladder billing for ad spend fee | Independent of the ads tables — reusable as-is. |
| `src/lib/ads-fee.ts` | 86 | `ADS_SELF_SERVE` flag, fee math, error-code → i18n | `feeBreakdown`/`creditsForSpend`/`adsErrorMessage`/`normalizeUrl` reusable as-is. `ADS_SELF_SERVE` is the placeholder gate — removed from the Social Ads page in this phase (see below). |
| `src/lib/server/zernio-ads.ts` | not shown above, Zernio's `/v1/ads/*` HTTP client | wraps boost/create/accounts/analytics via `ZERNIO_API_KEY` | This **is** how Meta ads are reached today: Zernio, not the raw Marketing API, not Composio. Same pattern as organic publishing (`zernio.ts`). Client itself (HTTP wrapper) is reusable; what it's fed (brand/account ids) is not. |
| `src/routes/p/[projectId]/ads/connect/[channel]/+server.ts` | — | OAuth kickoff via `ensureBrandProfile`/`getAdsConnectUrl` (zernio.ts) | Same Zernio OAuth pattern used for organic social connect. Selects `brands.plan, status, zernio_profile_id` — **broken** on live schema, would 500/behave wrong today. |
| Routes: `ads/{social,google,[channel],connect,library}` | — | thin wrappers around `ads-actions.ts` | Render `AdsBookCallPlaceholder` unconditionally because `ADS_SELF_SERVE = false`; even with it on, brand-column reads fail. |

**`ADS_SELF_SERVE` other uses** (grep confirmed): `src/lib/ads-fee.ts` (definition),
`src/lib/components/AdsBookCallPlaceholder.svelte`, `src/lib/server/ads-actions.ts`,
`src/lib/server/ads-flag.test.ts`. Contained — safe to strip from the Social Ads page without
touching Google ads' page (out of scope here) or other surfaces.

## How Meta ads are reached today

Via **Zernio**, the same provider used for organic publishing (`src/lib/server/zernio.ts`),
not the raw Meta Marketing API and not Composio. `zernio-ads.ts` wraps Zernio's `/v1/ads/*`
(boost, create, accounts, analytics); OAuth for the ad account goes through
`ensureBrandProfile` + `getAdsConnectUrl`, landing back on `?connected=1`. This is worth keeping
as the integration point in phase 2 — the wrapper is provider-agnostic in shape, only the brand/
account plumbing feeding it needs to move to the new schema.

## Live ads tables already exist and are unused

`ad_accounts`, `ad_campaigns`, `ad_creatives`, `competitor_ads` are already defined in the new
schema (`database.types.ts`) with `org_id`/`brand_id`, `actor_kind`/`actor_id`/`agent_key`, and
real FKs (`ad_campaigns.ad_account_id → ad_accounts.id`, `ad_creatives.campaign_id →
ad_campaigns.id`, `ad_creatives.post_id → posts.id`). Nothing in the app reads or writes them —
they're the target of the rebuild, not a migration to write.

## Phase plan

### Phase 2 — connect a Meta ad account per brand
- **Files**: new `src/lib/server/repos/ad-accounts.ts` (CRUD on `ad_accounts`), rewrite
  `ads/connect/[channel]/+server.ts` to select live `brands` columns and write `ad_accounts`
  rows keyed by `brand_id`/`org_id`, reuse `zernio.ts`'s `ensureBrandProfile`/`getAdsConnectUrl`.
- **Tables**: `ad_accounts` (read/write), `brands` (read only, live columns).
- **Endpoints**: `GET /p/[projectId]/ads/connect/[channel]`, new
  `api/v1/brands/[slug]/ads/accounts` (list/sync) if CLI needs it.
- **MCP tools**: `ads_action` equivalent — connect/list ad accounts (check current MCP surface
  before adding; app leads, MCP follows per CLAUDE.md).
- **Paid external calls**: none yet — OAuth + account listing is free on Meta's side; Zernio may
  meter API calls.

### Phase 3 — create a campaign from a post or canvas media
- **Files**: `src/lib/server/repos/ad-campaigns.ts`, `ad-creatives.ts`; port
  `ads-generate.ts`/`ads-remix.ts` logic onto `ad_campaigns`/`ad_creatives`; propose→approve→
  launch actions in `ads-actions.ts` rewritten for the live tables.
- **Tables**: `ad_campaigns`, `ad_creatives` (write), `posts`/`nodes`/`assets` (read, creative
  source), `ad_accounts` (read).
- **Endpoints**: `POST /ads/social` actions (`propose`, `approve`, `reject`), CLI `dazero ads
  --propose` (already exists — needs pointing at new endpoint).
- **MCP tools**: propose/approve campaign tools.
- **Paid calls**: Zernio boost/create (spends real ad budget on approve — gated by
  `gateAiAction`-style credit check, `ads-credits.ts` reusable).

### Phase 4 — metrics sync + list
- **Files**: `syncAdMetrics` rewritten against `ad_campaigns`/`ad_creatives`, `ads-fatigue.ts`
  reused as-is once fed real rows.
- **Tables**: `ad_campaigns`, `ad_creatives` (write metrics/status), read for list/dashboard.
- **Endpoints**: sync action, dashboard summary endpoint.
- **Paid calls**: Zernio analytics fetch (metered, not ad spend).

### Phase 5 — competitor ads library
- **Files**: `src/routes/p/[projectId]/ads/library` rebuilt against `competitor_ads`.
- **Tables**: `competitor_ads` (read/write, likely populated by a scraper — check ScrapeCreators
  per refactor-scope memory).
- **Endpoints**: library list/search.
- **Paid calls**: none directly (scrape ingestion is a separate job, out of this scope).

## What's reusable vs dead, in one line

Reusable as-is: `ads-credits.ts`, `ads-fee.ts` (minus the flag), Zernio HTTP wrapper
(`zernio-ads.ts`), fatigue/generate/remix *logic* (needs new table plumbing, not a rewrite).
Dead: every `brands.plan/status/zernio_profile_id` read, every `zernio_ad_accounts` reference,
`ADS_SELF_SERVE` gating on the Social Ads page, `AdsBookCallPlaceholder` as the page's only
state.
