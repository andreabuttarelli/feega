# Social feed node: understand any pasted URL, not just a profile

Before this, `normalizeHandle` only extracted a username from a handful of
profile URL shapes; platform still had to be picked manually, and pasting a
single post, a hashtag or several accounts at once either synced the wrong
thing or did nothing.

`classifySocialInput`/`classifySocialLines` (`social-url-classifier.ts`) is
the one table that reads what a pasted URL or handle means, per platform —
instagram, tiktok, x/twitter, threads, facebook, youtube, linkedin:

| Input shape | kind | what happens |
|---|---|---|
| profile URL (incl. `m.`/`www.`, `@handle`, youtube `/@x` `/channel/UC…` `/c/x` `/user/x`, linkedin `/company/x` `/in/x`) | `profile` | platform auto-detected, handle extracted, account synced as before |
| single post URL (instagram `/p/` `/reel/` `/tv/`, tiktok `/@u/video/id`, x `/status/id`, threads `/post/`, youtube `watch?v=` `youtu.be` `/shorts/`, facebook `/posts/` `/videos/`) | `post` | that one post fetched via ScrapeCreators' single-post endpoints |
| `#tag` or an explore/tag URL (instagram, tiktok) | `hashtag` | rejected with an explicit "not supported yet" — no hashtag search endpoint wired |
| a bare handle with no domain | `profile` | platform stays whatever is already picked on the node — text alone can't say which platform |
| several of the above, one per line or comma-separated | each classified and synced separately, tagged with its own platform |
| an unrecognized domain (reddit, pinterest, garbage) | rejected with the reason, never a silently empty node |

`commitHandleField` (`node-inspector.ts`) is the one place that touches two
columns from one field: a single recognized profile URL sets `platform` too;
everything else (a post, a hashtag, multiple lines) is left in `handle`
as-is and reclassified at sync time by `syncSocialFeedEntries`
(`social-feed-sync.ts`), so the raw text a person pasted stays visible and
editable. `sync_summary` — the same field products already uses for "1
product"/"whole store" — now carries "Instagram · profile @nike",
"TikTok · 1 post", etc., added to the shared `syncState` in `node-data.ts`
so `describe_node_types` (MCP) picks it up automatically.

New in `scrapecreators.ts`: `fetchSinglePost`/`isSinglePostPlatform`, one
endpoint + mapper per platform (`/v1/instagram/post`, `/v2/tiktok/video`,
`/v1/twitter/tweet`, `/v1/threads/post`, `/v1/facebook/post`,
`/v1/youtube/video`) — linkedin has no single-post endpoint, so a linkedin
post URL is rejected explicitly rather than silently downgraded to a
profile sync.

Discarded: a hashtag search — no cheap ScrapeCreators endpoint for it, so it
stays an explicit rejection rather than a guess; resolving `vm.tiktok.com`
short links server-side — no redirect-following added yet, flagged as
`unsupported` with a clear reason instead of silently failing.

Verified live against the real ScrapeCreators API (real API key, few cheap
calls, not mocked): an Instagram post, a TikTok video and a Facebook video
post fetched correctly end to end, and a YouTube `@handle` classified as a
profile. Instagram's real response wraps the post under
`data.xdt_shortcode_media`, not flat as the provider's docs summary implied
— `instagramSingle` was fixed to unwrap it after the live call came back
with caption/thumbnail/date all null. Facebook's video lives under
`video.hd_url`/`sd_url`, not a `videoDetails` object — same fix, same
reason: written from docs, wrong against the real endpoint, caught by the
live call and covered by a fixture test (`scrapecreators-single-post.test.ts`)
so it doesn't need a live call to catch it again.
