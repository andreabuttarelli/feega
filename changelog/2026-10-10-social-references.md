# Social video references for both chat agents

Both agents (canvas chat and motion chat) gain `social_search(platform, query, limit)`, backed by
ScrapeCreators keyword search: TikTok `/v1/tiktok/search/keyword`, Instagram
`/v2/instagram/reels/search` (`/v1` is 404), YouTube `/v1/youtube/search`. 1 credit per call
($0.002), live-verified 2026-10-10, fixtures in `src/lib/server/web/fixtures/social-search-*.json`.

- `web/social-search.ts` maps the three shapes into one `Clip` through a per-platform table
  (path, list key, mapper). Pure: no `$env`, so it does not reuse the TikTok mapping in
  `scrapecreators.ts`, which drags in Supabase and storage.
- YouTube gives no playable url (`video: null`); TikTok and Instagram do.
- One request per call, no pagination; at most 20 clips, default 10, 6 calls per turn.
- Cost goes into the turn cap via `spend` and into `ai_calls` through `scrapeCreatorsGet`, under
  the same brand/org billing scope as Pinterest (`billedScrape` in `live.ts`).
- Clips already shown are filtered like pins; `social_search` joins `REFERENCE_TOOLS`.
- Seeing: text only; the agent looks at thumbnails with `view_images`.
