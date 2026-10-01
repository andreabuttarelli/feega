# Landing page → template on the first canvas

**Why.** 12 signups, zero generations: everyone landed on an empty canvas.
The Framer feature pages link to `oh.feega.app/?utm_campaign=<slug>`; that
intent was thrown away at the root redirect.

**Mapping.** One table, `CAMPAIGN_TEMPLATES` in
`src/lib/onboarding/campaigns.ts`, slug → template id. A test fails if a
landing slug is missing or points to no template.

**Persistence.** First-party cookie `feega_campaign`, set by
`rememberCampaign` (`src/lib/server/onboarding/campaign-cookie.ts`) on the
root hit, before the `/login` redirect. httpOnly, SameSite=Lax, 7 days,
value restricted to the table's slugs. It is strictly necessary
(delivers the workflow the visitor asked for, no identifier, no
tracking), so it is outside the consent banner. It survives email
confirmation and OAuth because both come back to the same browser
(`/auth/callback`). Discarded: writing it on the profile at signup — the
profile does not exist until after confirmation, and OAuth signups never
pass through a form we control.

**Insertion.** `landingPath` / root redirect → `takeCampaign` (reads and
deletes the cookie) → `homePathFor(..., campaign)` → `seedWelcome`
(`src/lib/server/onboarding/welcome.ts`): only on an empty landing
canvas, only if `claimCampaignTemplate` flips
`profiles.campaign_template_at` from null (atomic claim, so two tabs
cannot insert twice), then `insertTemplate` centred at the origin
(the canvas fits view on open). The path carries `?welcome=<slug>`; the
canvas page fires `template_auto_inserted {campaign}` (consent-gated
`track`) and strips it.

**Schema.** `20261001150000_profiles_first_run.sql`: `signup_campaign`,
`campaign_template_at`, `onboarding_status` on `profiles` (additive).

**Templates.** New: `anime-video`, `claymation-video`, `paper-cutout`,
`retro-vhs`, `3d-animation` (one `styledClip` shape: subject note →
styled keyframe → clip), `spotify-canvas` (same still as first and last
frame for a loop), `ai-commercial`, `text-to-video`, `hd-clip`.
`ai-video-styles` → `style-transfer`, `ai-node-editor` → `brief-to-reel`
(reused). New templates use the cheapest catalogue models
(`seedream-5-lite`, `seedance-2-mini`) so they fit the welcome credits.
There is no upscaler node yet: `hd-clip` renders a new 1080p clip and its
note says how to upscale an existing one (FLUX Video Upscale).

**Thumbnails.** 9 renders with `openai/gpt-image-2.5-flare` on OpenRouter
`/images` (one retried after a 520), $0.065 total, 600×400 WebP q78.
