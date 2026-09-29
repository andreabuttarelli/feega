# Promote: one entry point for organic posts and Meta ads

Before: "Create post" on the canvas selection opened a composer; paid ads had
no working path (the old stack read columns that no longer exist).

Now "Promote" (selection toolbar, canvas top bar, mobile top bar when
something is selected) opens `/promote` with two tabs:

- **Organic post** — the existing composer, moved from the `create-post`
  route to `components/promote/OrganicPostForm.svelte`, still posting to the
  canvas `create_post` action (`createPostFromNodes`). No second composer.
- **Paid ad** — `PaidAdForm.svelte` → `promote?/propose_ad` →
  `proposePaidAd` (`server/ads/paid-ads.ts`) → `ad_campaigns` (`draft`) +
  `ad_creatives` (media as `{assetId, order}`, or `post_id` for a boost).

Money moves only in `launchCampaign`, reached from the Ads page "Approve and
launch" (`ads?/launch`) or `POST api/v1/org/ads/campaigns/[id]/approve`
(refused for API keys). Order: credit check → `approveCampaign` (the atomic
draft→scheduled gate) → sign media for the provider → Zernio
`/ads/create` or `/ads/boost` → `active`, or `failed` with the error.
Pause/resume: `setCampaignRunning` → Zernio `/ads/campaigns/{id}/status`.

Meta connect: `ads/connect` starts Zernio's `/connect/facebook/ads` from the
brand's Facebook social account profile (no Facebook → organic connect
first); `/ads?connected=1` runs `syncMetaAdAccounts` into `ad_accounts`.

Tables of rules, not ifs: draft validation (`DRAFT_RULES`), placements →
Zernio positions (`PLACEMENTS`), paid gate (`PAID_GATES`), actions per
campaign status (`ACTIONS_BY_STATUS`).

Also: `/ads/social` → `/ads` (redirect kept); `zernio-ads.ts` sends
`placements` as Zernio's object and video as `video: {url}` per the current
OpenAPI; MCP `create_ad_campaign` takes the Promote draft shape and a new
`set_ad_campaign_status`; CLI `feega ads --pause/--resume`.

Not built: metrics sync (Ads page says so instead of showing numbers), AI
copy suggestions, interest targeting (Zernio needs interest ids from a
search endpoint). Launch, boost, pause and connect were verified only against
a mocked Zernio — they need a real Meta ad account.
