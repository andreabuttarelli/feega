# Remove the social publishing surface

The `social_publishing` flag (table `feature_flags`) hid Ads, Promote,
connected accounts and the Facebook/LinkedIn/connect pages since the product
moved to canvas + motion. The flag was off in production; the code stayed.
Decision 2026-10-22: features out of the product leave the code.

Removed:
- Routes `/p/[projectId]/ads`, `/promote`, `/social-thumbs`,
  `settings/connected-accounts`, `settings/connect/[platform]`,
  `settings/facebook`, `settings/linkedin`, the OAuth return redirect in
  `settings/+page.server.ts`, `GET /api/v1/features`.
- The flag: `$lib/social-publishing`, `$lib/server/social-publishing`, the
  hook guard, `socialPublishing` in the root shell, nav/settings/add-bar
  filtering, Promote buttons in the canvas top bars, `Capability.Promote`/
  `Publish`.
- Zernio: `zernio.ts`, `zernio-ads.ts`, `publishing/`, the status check, the
  e2e mock and Playwright env.
- Ads: `$lib/ads`, `server/ads`, `repos/ads.ts`, `ads-credits.ts`,
  `meta-ad-library.ts`, `components/promote`.
- Seat billing: `account-billing.ts` and its hourly renewal in the canvas
  tick (it charged credits for connected accounts nobody could manage),
  `social-connections.ts`, seats in the settings shell.
- `PUT|GET /api/v1/brands/:slug/settings/brand` and the `SET_BRAND_SETTINGS`
  contract (timezone/hashtags/target platforms for publishing; no tool used
  it), with its doc page.

Kept: tables and migrations; `jsonb-schemas` for `ad_campaigns` (the generic
write tool still validates rows); `competitor-ads.ts`/`market-references.ts`
(image generation still reads competitor references); the `calendar` canvas
node type, now out of the add bar and shortcuts like `iframe` (existing nodes
still render).
