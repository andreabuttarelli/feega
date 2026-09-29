# Google Ads removed; dead ads stack deleted

Ads are Meta only: the live schema already says so (`ad_accounts.platform`
check `= 'meta'`). Removed with Google:

- routes `ads/google`, `ads/[channel]/new`, `ads/library`, `ads/connect/[channel]`,
  `settings/ads`, `settings/ads/accounts`, `api/v1/brands/[slug]/ads` (+ `remix`);
- `server/ads.ts`, `ads-actions.ts`, `ads-generate.ts`, `ads-remix.ts`,
  `ads-fatigue.ts` and the `Ads*` components. All of them read
  `zernio_ad_accounts`, `brands.plan`, `brands.ads_settings`,
  `brands.zernio_profile_id` — none exist on the live schema, so every page
  404'd behind `ADS_SELF_SERVE = false` or failed its query;
- contracts `ADS_ACTION`, `ADS_REMIX`, `GET_ADS`; CLI `ads` flags that called
  the deleted endpoint (`--sync --propose --remix --create --reject --duplicate
  --delete --pause --resume --ad`). `feega ads <slug>` now lists the brand's
  campaigns from `api/v1/org/ads/campaigns`, `--approve` approves;
- Google branches in `zernio-ads.ts` (keywords, Search/Display, square image)
  and in `adTargetingSchema`.

Kept: `zernio-ads.ts` (Meta), `repos/ads.ts`, `ads-fee.ts` (fee math and
`normalizeUrl`), `ads-credits.ts`, `meta-ad-library.ts` (market references).

Guard: `src/lib/no-google-ads.test.ts` fails on any Google ads mention under
`src/lib`, `src/routes`, `cli`, `docs`. `src/app.html`'s marketing conversion
tag is not the product feature and stays.
