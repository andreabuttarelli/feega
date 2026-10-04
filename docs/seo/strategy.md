# SEO/GEO strategy — dalnulla.com → feega.app

Data: Search Console export for dalnulla.com, last period (185 clicks, ~8k impressions,
80 pages, 686 queries). Verified with curl on 2026-09-30.

## Findings

1. **Every old URL 404s after one hop.** `dalnulla.com/<path>` 308 → `feega.app/<path>` 308 →
   `www.feega.app/<path>` → 404 on Framer (only `/` exists live). Equity and the 72 clicks/period
   that landed on tool pages were lost. Fixed by the redirect map below (one hop, real target).
2. **The live Framer site has no legal pages yet** (`/privacy`, `/terms`, `/cookies` → 404): they
   exist in the project but were never published.
3. **The live sitemap lists template leftovers** (`/work/voltage`, `/work/nova`… 12 pages) and
   nothing else. They should be removed or set to noindex before publishing.
4. **No llms.txt, no structured data** on feega.app until now. The Framer plan does not include
   redirects, so `/llms.txt` cannot be served from Framer today.
5. **Demand is non-brand and international.** Brand ("dal nulla", "dalnulla") is 53 of 185
   clicks; tool pages rank 10–90 on high-volume English queries. IT has the best CTR (7.9 %), US
   most impressions (2,795), then IN, UK, ES, PH.
6. **Positions are weak where volume is.** "ai ad maker"-type queries sit at 75–90, "video
   enhancer" at 40–80. The realistic early wins are where dalnulla already ranked 10–30: VHS/80s,
   paper cutout, claymation, "ai video upscaler" (pos 14), "pixar 3d animation ai" (pos 10).

## Keyword clusters

Clicks / impressions summed over the queries in each cluster. "Served" is checked against the
code (`src/lib/video-models.ts`, `src/lib/image-models.ts`, `src/lib/canvas/audio-operations.ts`,
`src/lib/canvas/effects/`), not the old product.

| Cluster | Queries | Clicks | Impr. | Best pos. | Intent | feega today | Target page |
|---|---|---|---|---|---|---|---|
| AI commercial / ad maker | ~125 | 1 | ~1,500 | 38 (tv commercial maker) | make product video ads | Served: products node, image+video gen, voice-over/music, Meta ads (Meta only) | `/ai-commercial-maker` |
| Video upscale / enhance | 167 | 13 | 937 | 14 | upscale a clip, sharpen, "4k" | Served: `/app/upscale` + canvas, FLUX Video Upscale, MP4 ≤ 20 s, ≤ 1440p in, 2× or 4K out. Not served: denoise, stabilise, colourise, fps | `/ai-video-upscaler` |
| 3D animation | 75 | 4 | 742 | 10 (pixar 3d) | 3D-looking animated video | Served as video (Seedance/Kling). Not served: 3D model export | `/3d-animation-maker` |
| Paper cutout / stop motion | 47 | 0 | 392 | 23 | paper stop-motion style | Served (style prompt + first frame) | `/paper-cutout-animation` |
| Brand | 4 | 53 | 194 | 1 | find the product | Served | `/` |
| Generic AI video | ~98 | 4 | ~190 | 8 | text/image to video | Served | `/ai-video-styles` |
| Explainer video | 26 | 1 | 152 | 53 | narrated explainer | Partial: clips + TTS; no automatic assembly | `/ai-video-styles` (no dedicated page) |
| 80s / VHS / retro | 11 | 4 | 116 | 11 | VHS look | Served for generated clips; image effects. Not served: VHS filter on an uploaded video | `/80s-retro-video` |
| Character / person creator | 38 | 0 | 108 | 46 | create a character image | Served (image gen) — low intent, positions 60–97 | `/` (no page yet) |
| Spotify Canvas | ~6 | 0 | ~45 | 50 | vertical 3–8 s loop | Served as a video prompt | `/ai-video-styles` |
| Image generation | 27 | 0 | 53 | 55 | text to image | Served | `/` (no page yet) |
| Claymation | 7 | 0 | 35 | 9.5 | clay look | Served | `/claymation-ai` |
| Anime | 6 | 0 | 28 | 31 | anime video | Served | `/anime-video-generator` |
| Background removal (rembg, "remove background") | ~5 | 0 | ~25 | 8 | cut out a subject | **Not served** | `/` |
| Auto caption | 1 | 0 | 8 | 2 | subtitles | **Not served** | `/` |
| Colourize (deoldify) | 1 | 0 | 3 | — | colourize old video | **Not served** | `/` |

## Redirect map

Implemented in `src/lib/server/host-redirects.ts` (one table of exact paths, one of prefixes,
locale prefixes `/it` `/es` `/pt` `/de` `/fr` stripped, home as the last fallback), 308, query string kept, one hop.
Hosts: `dalnulla.com`, `www.dalnulla.com`, `r.feega.app`. Coverage: **80 / 80 URLs from
Pagine.csv land on a real page; 0 on a 404** once the Framer pages are published.

Rules, in order:

1. `/app/*` and `*/sign-in` go to the app (`oh.feega.app/`, `oh.feega.app/login`), whatever the
   locale prefix.
2. Locale prefixes are stripped: a localized URL goes to its English equivalent (English pages
   only, by owner decision).
3. Exact English path → its page (text/image-to-video and realistic tools → `/ai-video-generator`,
   Spotify Canvas → `/spotify-canvas-maker`).
4. Any other `/tools/*` → `/ai-video-styles` hub; `/docs*` (node docs) → `/ai-node-editor`.
5. Everything else (status, blog, not-served tools) → home.

| Old path | Clicks | Impr. | New target |
|---|---|---|---|
| `/` | 72 | 404 | www.feega.app/ |
| `/tools/80s-retro-video-maker` | 34 | 662 | www.feega.app/80s-retro-video |
| `/tools/ai-video-upscaler` | 28 | 1728 | www.feega.app/ai-video-upscaler |
| `/app/generate-video` | 8 | 215 | oh.feega.app/ |
| `/es/image-angles` | 7 | 39 | www.feega.app/ |
| `/tools/anime-video-generator` | 6 | 132 | www.feega.app/anime-video-generator |
| `/tools/3d-animation-maker` | 5 | 1052 | www.feega.app/3d-animation-maker |
| `/tools/paper-cutout-animation` | 4 | 613 | www.feega.app/paper-cutout-animation |
| `/tools/ai-commercial-maker` | 2 | 1774 | www.feega.app/ai-commercial-maker |
| `/tools/motion-background-generator` | 2 | 109 | www.feega.app/ai-video-styles |
| `/es/tools/time-lapse-video-maker` | 2 | 34 | www.feega.app/ai-video-styles |
| `/it/tools/fashion-runway-ai` | 2 | 30 | www.feega.app/ai-video-styles |
| `/it` | 2 | 14 | www.feega.app/ |
| `/es/tools/80s-retro-video-maker` | 2 | 14 | www.feega.app/80s-retro-video |
| `/character-generator` | 2 | 9 | www.feega.app/ |
| `/tools/explainer-video-ai` | 1 | 207 | www.feega.app/ai-video-styles |
| `/sign-in` | 1 | 123 | oh.feega.app/login |
| `/tools/text-to-video` | 1 | 39 | www.feega.app/ai-video-generator |
| `/privacy` | 1 | 15 | www.feega.app/privacy |
| `/es/tools/fantasy-video-maker` | 1 | 11 | www.feega.app/ai-video-styles |
| `/it/tools/movie-trailer-generator` | 1 | 7 | www.feega.app/ai-video-styles |
| `/it/tools/ai-commercial-maker` | 1 | 6 | www.feega.app/ai-commercial-maker |
| `/pricing` | 0 | 307 | www.feega.app/ |
| `/app/character-generator` | 0 | 213 | oh.feega.app/ |
| `/app/image-generator` | 0 | 150 | oh.feega.app/ |
| `/it/tools/spotify-canvas-maker` | 0 | 80 | www.feega.app/spotify-canvas-maker |
| `/status` | 0 | 74 | www.feega.app/ |
| `/it/tools/claymation-ai-generator` | 0 | 53 | www.feega.app/claymation-ai |
| `/docs/split-text-nodes` | 0 | 51 | www.feega.app/ai-node-editor |
| `/app/generate` | 0 | 50 | oh.feega.app/ |
| `/terms` | 0 | 41 | www.feega.app/terms |
| `/es/tools/realistic-ai-video` | 0 | 37 | www.feega.app/ai-video-generator |
| `/app/node-editor` | 0 | 31 | oh.feega.app/ |
| `/app/generate-video?mode=360` | 0 | 29 | oh.feega.app/?mode=360 |
| `/docs/list-selector-nodes` | 0 | 26 | www.feega.app/ai-node-editor |
| `/docs/html-nodes` | 0 | 25 | www.feega.app/ai-node-editor |
| `/es/tools/spotify-canvas-maker` | 0 | 24 | www.feega.app/spotify-canvas-maker |
| `/docs/api/generate-image` | 0 | 19 | www.feega.app/ai-node-editor |
| `/docs/prompt-concatenator-nodes` | 0 | 18 | www.feega.app/ai-node-editor |
| `/docs/prompting-guide` | 0 | 18 | www.feega.app/ai-node-editor |
| `/de/tools/spotify-canvas-maker` | 0 | 18 | www.feega.app/spotify-canvas-maker |
| `/it/tools/watercolor-video-generator` | 0 | 17 | www.feega.app/ai-video-styles |
| `/docs/ai-voice-nodes` | 0 | 16 | www.feega.app/ai-node-editor |
| `/docs/character-generator` | 0 | 15 | www.feega.app/ai-node-editor |
| `/es/tools/drone-video-generator` | 0 | 14 | www.feega.app/ai-video-styles |
| `/cookie-policy` | 0 | 13 | www.feega.app/cookies |
| `/de/tools/fantasy-video-maker` | 0 | 11 | www.feega.app/ai-video-styles |
| `/free-background-remover` | 0 | 11 | www.feega.app/ |
| `/docs/cookbook` | 0 | 9 | www.feega.app/ai-node-editor |
| `/es/tools/ai-video-generator-for-social-media` | 0 | 9 | www.feega.app/ai-video-generator |
| `/fr/auto-caption` | 0 | 8 | www.feega.app/ |
| `/it/tools/realistic-ai-video` | 0 | 8 | www.feega.app/ai-video-generator |
| `/it/sign-in` | 0 | 8 | oh.feega.app/login |
| `/pt/remove-video-background` | 0 | 8 | www.feega.app/ |
| `/pt/tools/ai-video-upscaler` | 0 | 7 | www.feega.app/ai-video-upscaler |
| `/app/generated-content` | 0 | 6 | oh.feega.app/ |
| `/shopify-photographer` | 0 | 6 | www.feega.app/ |
| `/pt/tools/spotify-canvas-maker` | 0 | 6 | www.feega.app/spotify-canvas-maker |
| `/remove-background` | 0 | 6 | www.feega.app/ |
| `/tools/image-to-video` | 0 | 6 | www.feega.app/ai-video-generator |
| `/#features` | 0 | 4 | www.feega.app/ |
| `/docs` | 0 | 4 | www.feega.app/ai-node-editor |
| `/es/tools/fashion-runway-ai` | 0 | 4 | www.feega.app/ai-video-styles |
| `/blog` | 0 | 3 | www.feega.app/ |
| `/fr/sign-in` | 0 | 3 | oh.feega.app/login |
| `/es/tools/claymation-ai-generator` | 0 | 3 | www.feega.app/claymation-ai |
| `/it/tools/horror-video-maker` | 0 | 3 | www.feega.app/ai-video-styles |
| `/de/tools/time-lapse-video-maker` | 0 | 3 | www.feega.app/ai-video-styles |
| `/pt/tools/text-to-video` | 0 | 3 | www.feega.app/ai-video-generator |
| `/draw-to-image` | 0 | 3 | www.feega.app/ |
| `/tools/spotify-canvas-maker` | 0 | 3 | www.feega.app/spotify-canvas-maker |
| `/tools/faceless-youtube-channel-generator` | 0 | 3 | www.feega.app/ai-video-styles |
| `/app/brands` | 0 | 2 | oh.feega.app/ |
| `/es/tools/watercolor-video-generator` | 0 | 2 | www.feega.app/ai-video-styles |
| `/fr/remove-background` | 0 | 1 | www.feega.app/ |
| `/pt/docs/upscaler-nodes` | 0 | 1 | www.feega.app/ai-video-upscaler |
| `/it/tools/ai-video-generator-for-social-media` | 0 | 1 | www.feega.app/ai-video-generator |
| `/es/tools/3d-animation-maker` | 0 | 1 | www.feega.app/3d-animation-maker |
| `/fr/tools/horror-video-maker` | 0 | 1 | www.feega.app/ai-video-styles |
| `/es/draw-to-image` | 0 | 1 | www.feega.app/ |

## Page plan (Framer, created unpublished)

All pages reuse the site's Navigation layout template (nav + footer), a 960 px column and the
site text styles. Each has: title and meta description, one H1, an answer-first intro, a hero
image, a "How it works on feega" section (add a node, connect, generate), how-to sections, an
examples grid (before/after on the upscaler), a FAQ, **three CTAs** (hero, after examples, after
FAQ) to `https://oh.feega.app/?utm_source=feega.app&utm_medium=seo&utm_campaign=<page-slug>`,
and links to the home page and every other landing page.

Images: 45 WebP files (43 generated with Seedream 5 Lite on OpenRouter, 2 "before" frames
downscaled locally from the generated "after"), ~6 MB total, uploaded to Framer with keyword alt
text. Generation cost: **$1.51** (43 images at $0.035; one prompt refused by moderation, not billed).

| Path | H1 | Primary cluster |
|---|---|---|
| `/ai-video-upscaler` | AI video upscaler | upscale / enhance |
| `/3d-animation-maker` | AI 3D animation maker | 3D animation |
| `/ai-commercial-maker` | AI commercial and ad maker | commercial / ad |
| `/paper-cutout-animation` | Paper cutout animation maker | paper / stop motion |
| `/claymation-ai` | Claymation AI generator | claymation |
| `/80s-retro-video` | 80s retro and VHS video generator | 80s / VHS |
| `/anime-video-generator` | AI anime video generator | anime |
| `/ai-video-styles` | AI video styles (hub) | long-tail styles |
| `/spotify-canvas-maker` | Spotify Canvas maker | spotify canvas (dalnulla pos 8–50, 5 old URLs) |
| `/ai-video-generator` | AI video generator: text to video and image to video | generic AI video, text/image-to-video, realistic |
| `/ai-node-editor` | AI node editor for images, video and audio | node-based workflows — what feega is |

English only, by owner decision. Two IT/ES pages drafted earlier (`/it/video-ai`,
`/es/video-ia`) were emptied and set to draft: the Framer API cannot delete pages — delete them
by hand in Framer.

Not built, on purpose: pages for background removal, captions, colourization (not served);
character/image generator (low intent, positions 46–97 — revisit after the video pages rank).

## Keyword attack list (prioritised)

Order = (existing position × volume × fit with the product). Served only.

| # | Query group | Old pos. | Impr. | Page | Why now |
|---|---|---|---|---|---|
| 1 | vhs generator, vhs video generator, 80s generator, 80s video maker | 11–24 | ~110 | `/80s-retro-video` | Already page 1–2; clicks at 5 % CTR |
| 2 | ai video upscaler, ai video upscale, video upscaler | 14–21 | ~130 | `/ai-video-upscaler` | Best position in the largest served cluster |
| 3 | claymation, claymation ai generator | 9.5–11 | ~90 | `/claymation-ai` | Page 1 already |
| 4 | paper cut-out animation, paper stop motion, paper animation ai | 23–29 | ~390 | `/paper-cutout-animation` | Volume at striking distance |
| 5 | pixar 3d animation ai, 3d animation ai, ai 3d animation | 10–45 | ~740 | `/3d-animation-maker` | Largest cluster with one query already at 10 |
| 6 | spotify canvas maker, spotify canvas | 8–50 | ~60 | `/spotify-canvas-maker` | Low competition, exact-match intent |
| 7 | how to make free ai videos, text to video, ai video generator | 7.5–78 | ~70 | `/ai-video-generator` | Head term; long game, but the page catches generic intent |
| 8 | ai node editor, ai canvas, node-based image/video generation, comfyui alternative online | — (no dalnulla data; `/app/node-editor` had 31 impr. at pos 6) | new | `/ai-node-editor` | Exactly what feega is; category-defining for GEO |
| 9 | ai commercial maker, ai ad generator | 60–90 | ~1,500 | `/ai-commercial-maker` | Biggest volume, weakest position: needs links and depth |
| 10 | video enhancer ai, enhance video quality | 40–85 | ~800 | `/ai-video-upscaler` | Secondary keywords on #2 |

## GEO

- **JSON-LD** (site custom code, head end, set on Framer): `Organization` (hi@, support@),
  `SoftwareApplication`, and a `FAQPage` per landing page injected by path from the same FAQ
  text shown on the page.
- **llms.txt**: drafted in `docs/seo/llms.txt`. Framer cannot serve it at `/llms.txt` on the
  current plan (no redirects, no root files). Options: upgrade the plan and redirect
  `/llms.txt`, or host it on the app and link it.
- **Answer-first copy**: every page opens with one or two sentences that answer the query with
  concrete facts (model names, 15 s / 30 s limits), then states what it does not do. Those limits
  are what an AI engine can quote without being wrong.
- **Sitemap**: Framer generates it on publish; the new pages enter it automatically. Remove the
  `/work/*` template pages first.

## What you must do

1. **Publish the Framer site** (after review), otherwise the redirects land on 404s. Remove or
   noindex the `/work/*` template pages before publishing.
2. **Delete the two drafted pages `/it/video-ai` and `/es/video-ia` in Framer.**
3. **Merge the PR only after the Framer publish.**
4. **Search Console → dalnulla.com property → Settings → Change of address → feega.app**
   (requires both properties verified, and the 301/308s live).
5. **Submit `https://www.feega.app/sitemap.xml`** in the feega.app property.
6. **Keep dalnulla.com renewed** for at least 12 months, ideally indefinitely: the redirects only
   work while the domain resolves to this app.
7. Optional: upgrade the Framer plan for redirects (serves `/llms.txt`, and `/pricing` etc.
   typed directly on feega.app).

## 90-day plan

| Weeks | Action | Measure |
|---|---|---|
| 0–1 | Publish pages, merge redirects, change of address, submit sitemap | Old URLs 308 → 200 in one hop (curl); pages indexed |
| 2–4 | Inspect the 10 pages in Search Console; add one real example clip or image per page (Framer) | Impressions on target queries in the feega.app property |
| 4–6 | Expand the pages with the best early positions (VHS, paper, claymation, upscaler) with a prompt gallery | Position < 20 on "vhs generator", "paper cut-out animation", "claymation" |
| 6–8 | Add example clips and prompt galleries to the commercial and 3D pages | Position trend on the two largest clusters |
| 8–10 | Comparison/alternative content for "ai commercial maker" and "video enhancer" (positions 60–90 need depth and links) | Position trend on the commercial cluster |
| 10–13 | Review: prune pages with no impressions, add character/image page if demand holds; GEO check (ask ChatGPT/Perplexity the target queries, record citations) | Clicks on feega.app ≥ the dalnulla baseline (185 / period) |

## Video upscaler plan (2026-10-04)

Baseline (GSC): "ai video upscaler" 92 impr, pos 13.5; "video upscaler" 42 impr, pos 18.8.
Product now delivers the promise: tool `/app/upscale`, campaign `ai-video-upscaler` lands there.

1. **Landing rewrite** — `docs/seo/upscaler-page.md`: H1 "AI Video Upscaler", answer-first
   intro, real before/after (from a real run), 3 steps, specs, honest comparison, 5-question
   FAQ, FAQPage + SoftwareApplication + VideoObject JSON-LD, CTA with UTM to `/app/upscale`.
   Fix first: the live page says 30 s (model takes 20 s).
2. **Internal links** — home tools list → `/ai-video-upscaler`; `/ai-video-generator` and
   `/ai-commercial-maker` link it ("then upscale it").
3. **Supporting articles** (drafts in `docs/seo/articles/`): how to upscale video to 4K; upscale
   old/blurry video; best AI video upscalers 2026. Each links the landing with one anchor.
4. **Not targeted**: "video upscaler online free" as a head term (we are paid) — answered in the
   FAQ only; "ai video enhancer" beyond upscale (denoise/colour not served).

KPIs (Search Console, page `/ai-video-upscaler`, 28-day windows vs baseline):
- avg position for "ai video upscaler" < 10 by +8 weeks; "video upscaler" < 15;
- impressions on "upscale video to 4k" cluster (new queries) > 100/28 d;
- CTR on the page ≥ 3 % once on page 1;
- FAQ rich result shown (Enhancements report, no FAQ errors);
- downstream: sign-ups with `utm_campaign=ai-video-upscaler` and first `/app/upscale` run.
