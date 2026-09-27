# Social Ads renders its real UI instead of the book-a-call placeholder

Phase 1 of the ads engine rebuild (audit in `docs/ads-rebuild.md`): the old ads code (`ads.ts`,
`ads-actions.ts`) targets a schema that no longer exists — `zernio_ad_accounts`,
`brands.plan/status/zernio_profile_id` — confirmed dead by `schema-drift-check.mjs`
(`ad_campaigns → zernio_ad_accounts` has no relationship). `ADS_SELF_SERVE = false` made the page
always render `AdsBookCallPlaceholder`, on top of that.

## What changed

- `src/routes/p/[projectId]/ads/social/+page.server.ts` rewritten from scratch: resolves the
  brand from live `brands` columns (`repos/brands.ts::findBrand`, same pattern the calendar
  already uses — `brand-shell.ts`'s columns 42703 silently), and the state through
  `ads-social-load.ts::buildAdsSocialState`, a pure function with its own test
  (`ads-social-load.test.ts`) covering all three states.
- `+page.svelte` rewritten: no brand → a card linking to the brand wizard
  (`/p/[projectId]/brands/new`); brand but no `ad_accounts` row → a card with a disabled connect
  button and the reason (the OAuth connect route is still on the old schema, phase 2's job);
  ready → the real campaigns panel (`ad_campaigns`, empty today — nothing writes to it yet) and a
  short "how it works" list. `ADS_SELF_SERVE`/`AdsBookCallPlaceholder` no longer touch this route.
- Reused `src/lib/server/repos/ads.ts::listAdAccounts`/`AdAccount`, already on the new schema
  (`ad_accounts`/`ad_campaigns`/`ad_creatives`) — no new repo needed.
- Removed 7 now-dead i18n keys the old page's propose/candidates section used
  (`proposeBoosts`, `proposedOk`, `candidates`, `candidatesSub`, `candidatesHint`, `proposing`,
  `noCandidates`); added `noBrand`/`noAdAccount`/`steps` for the new states.

## What's still broken, on purpose (later phases)

Campaigns list is always empty — nothing writes `ad_campaigns` yet (phase 3). The Meta connect
button is disabled — `ads/connect/[channel]/+server.ts` still reads dead `brands` columns
(phase 2). Google ads and the ads library routes are untouched, same schema mismatch.
