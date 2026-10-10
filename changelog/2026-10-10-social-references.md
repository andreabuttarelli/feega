# Social references for both chat agents

The ask: "make something in the style of @username on Instagram", and pictures and videos from
other socials as references, in the canvas chat and the motion chat. Before, the only reference
source was Pinterest (stills).

New tools (`web/web-tools.ts`), all on ScrapeCreators, 1 credit ($0.002) per request:

- `social_search(platform, query, limit)`: keyword search, TikTok `/v1/tiktok/search/keyword`,
  Instagram `/v2/instagram/reels/search` (`/v1` is 404), YouTube `/v1/youtube/search`. Mapped by a
  per-platform table in `web/social-search.ts` (pure; fixtures `fixtures/social-search-*.json`).
- `social_profile(platform, handle, limit)`: latest posts of an account, through
  `fetchProfileHistory` with `maxPages: 1` (one request). Handle, `@handle` or profile URL
  (`profileAccount`; a URL decides the platform).
- `social_post(url)`: one post, through `classifySocialInput` + `fetchSinglePost`. A URL that is
  not a post is refused before any request.
- Both return `SocialItem` (`web/social-posts.ts`): kind image/video/carousel/text, images (a video
  gives its cover), video URL, seconds, date, likes/comments/views.
- `view_video_frames(video, cover)`: cover + frames at 25/50/75 %. Download via `safeFetchBytes`
  https-only (80 MB cap), stills with ffmpeg (`web/video-stills.ts`, `ensureFfmpegPath`), each
  frame stored and screened like `view_images` through `viewBytes` (extracted from `viewOne`).
  YouTube has no playable URL: cover only. Video URLs are signed and short-lived: looked at in the
  same turn.

Rules:

- One shared cap, `MAX_SOCIAL_PER_TURN` = 10, across the four social tools. Cost into the turn via
  `spend` and into `ai_calls` via `scfetch`, under the brand/org scope (`scrapeBilling` in
  `live.ts`, shared with Pinterest).
- All four are in `REFERENCE_TOOLS`, so viewed frames return as references in the motion
  self-check.
- `set_reference_look` gains `pacing` (seconds per shot, how it cuts). Recorded, not gated yet.
- Guidance: "in the style of @x" = `social_profile` → look → `ask_reference_pick` →
  `set_reference_look` as the aggregate of the account → storyboard. Style only, never others'
  content as the brand's own; uncensored projects: no people.

Discarded: reusing `video-fetch.ts` helpers (private, and it trims for reviews); paging profiles
(one page is enough to read a style, more costs credits).

Found by the real check (`scripts/eval/social-refs-check.ts`, throwaway account, both cases):

- The reference grid drew broken pictures: Instagram and TikTok CDNs refuse to be embedded, and
  the agent re-types signed urls with a different query. `ask_reference_pick` now stores and
  screens every candidate without a stored copy (`preview`), drops refused ones, and the grid
  shows the copy.
- Saved tool outputs over 2,000 chars become strings; viewing tools are now kept whole
  (`VIEWING_TOOLS`), or the chat lost the thumbnails of what the agent watched.
