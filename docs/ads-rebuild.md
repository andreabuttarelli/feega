# Ads — Meta only, from the canvas

## Scope

One channel: **Meta** (Facebook + Instagram). The schema says so — `ad_accounts.platform` has a
`check (platform = 'meta')`. Every other ad network, and the pre-canvas ads stack that read
`zernio_ad_accounts`, `brands.plan`, `brands.ads_settings` (columns that no longer exist), was
deleted on 2026-09-29.

## The one entry point: Promote

Select nodes on a canvas → **Promote** (selection toolbar, or the top bar / mobile menu) → a sheet
with two tabs:

| Tab | What it does | Where it lands |
|---|---|---|
| Organic post | the create-post composer: brand, accounts, caption, media order, schedule | `posts` (+ Zernio delivery when scheduled), visible in the calendar |
| Paid ad | brand, Meta ad account, objective, budget, duration, audience, placements, creative | `ad_campaigns` (`draft`) + `ad_creatives` |

## Money moves only on an explicit approve

`draft` → (a person clicks Approve) → `scheduled` → Zernio `POST /v1/ads/create` → `active`, or
`failed` with the provider error. An API key can create a draft but can never approve it
(`api/v1/org/ads/campaigns/[id]/approve`). Before launch the org must afford the management fee
(`ads-fee.ts` `feeBreakdown`, `ads-credits.ts`).

## Provider

Zernio `/v1/ads/*` (`src/lib/server/zernio-ads.ts`). Ad account connect is Zernio's
`/v1/connect/facebook/ads`, started from the brand's Facebook connection (its Zernio profile).

## Not built yet

- Metrics sync (spend, impressions, clicks) — the Ads page shows budget and status only, never
  invented numbers.
- Competitor ads library (`competitor_ads`).
