import { swallow } from '$lib/server/swallow';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { createAdminClient } from '$lib/server/supabase-admin';
import { archiveImageToBucket } from '$lib/server/media-archive';
import { logAiCall } from '$lib/server/ai-log';

// scrapecreators pulls the FULL organic post history that Zernio can't expose. We hit one
// public endpoint per platform using the handle/url declared for the brand, normalise every
// shape into NormalizedPost, and store the result in:
//   - scrapecreators_cache  → GLOBAL per (platform, handle), near-permanent, avoids paying for
//                             the same profile twice (works even before a brand row exists).
//   - social_post_history   → per brand, what the planner/context actually reads.
// Zernio still owns connect + publish.
const BASE = 'https://api.scrapecreators.com';

function apiKey(): string {
  const k = env.SCRAPECREATORS_API_KEY;
  if (!k) throw new Error('SCRAPECREATORS_API_KEY not configured');
  return k;
}

// Exported for the Reddit endpoints (same key, same gateway, zero new services).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scrapeCreatorsGet(path: string): Promise<any> {
  return scfetch('GET', path);
}

/** POST variant — Meta Ad Library company/search when the cursor/query is too large for GET. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scrapeCreatorsPost(path: string, body: Record<string, unknown>): Promise<any> {
  return scfetch('POST', path, body);
}

// ScrapeCreators bills a flat 1 credit per request on EVERY endpoint ($10/5k → $0.002/req,
// verified on their pricing 2026-07). Each request is logged to ai_calls so it bills the
// brand's credits like any AI call (brand_id comes from the withBrandContext scope).
const SCRAPECREATORS_COST_USD = 0.002;

/**
 * Hard ceiling on a single request. Node's `fetch` has NO default timeout, so a stalled connection
 * hangs until something else kills the process.
 *
 * That is not hypothetical here: two hashtag searches were measured hanging **43.7 minutes** before
 * failing. Every caller that aggregates with `Promise.all` — the trend sweep does — waits for the
 * slowest job, so one stalled socket took down whole runs: the function hit its wall with nothing
 * written, no run row, no error row, because the code that records those never got to run. Under
 * the old 300s wall it looked like "the tick was slow"; it was one socket.
 *
 * 60s is generous on purpose. The slowest legitimate responses observed are LinkedIn 404s at ~46s,
 * so this bounds the pathological case without cutting off a merely slow one.
 */
export const SCRAPECREATORS_TIMEOUT_MS = Number(env.SCRAPECREATORS_TIMEOUT_MS ?? '') || 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scfetch(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<any> {
  const t0 = Date.now();
  // The endpoint (path without query) identifies WHAT was scraped in cost reports. Computed from a
  // parameter that must exist — see the arity gate in scripts/typecheck-runtime.mjs, added after a
  // signature change left eight callers passing `path` as `method` and this line throwing on
  // undefined for a week.
  const endpoint = String(path ?? '').split('?')[0].slice(0, 120);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'x-api-key': apiKey(),
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {})
      },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(SCRAPECREATORS_TIMEOUT_MS)
    });
    if (!res.ok) {
      logAiCall({ label: 'scrape', provider: 'scrapecreators', ms: Date.now() - t0, ok: false, error: `HTTP ${res.status}`, context: endpoint, flatCostUsd: SCRAPECREATORS_COST_USD });
      throw new Error(`scrapecreators ${res.status}: ${await res.text()}`);
    }
    logAiCall({ label: 'scrape', provider: 'scrapecreators', ms: Date.now() - t0, ok: true, context: endpoint, flatCostUsd: SCRAPECREATORS_COST_USD });
    return res.json();
  } catch (e) {
    // A timeout surfaces as a bare TimeoutError/AbortError, which in a log reads the same as any
    // other network blip. Naming it is what turns "fetch failed" into a diagnosis.
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    const err = timedOut
      ? new Error(`scrapecreators timeout after ${SCRAPECREATORS_TIMEOUT_MS}ms: ${endpoint}`)
      : e;
    if (!(e instanceof Error && e.message.startsWith('scrapecreators'))) {
      logAiCall({ label: 'scrape', provider: 'scrapecreators', ms: Date.now() - t0, ok: false, error: err instanceof Error ? err.message : String(err), context: endpoint, flatCostUsd: SCRAPECREATORS_COST_USD });
    }
    throw err;
  }
}

/** One slide of a carousel — same media shape whether it stands alone or sits inside a post. */
export type MediaItem = { type: 'image' | 'video'; url: string; thumbnailUrl: string | null };

// Normalised post = the subset of fields social_post_history actually stores.
export type NormalizedPost = {
  externalId: string;
  url: string | null;
  content: string | null;
  mediaType: 'image' | 'video' | 'text' | null;
  thumbnailUrl: string | null;
  publishedAt: string | null; // ISO
  metrics: Record<string, number | null>;

  /**
   * EVERY SLIDE, IN ORDER. A single-media post still carries one entry here — `thumbnailUrl`
   * stays the first slide's thumbnail for back-compat with readers that never learned about
   * carousels. Only Instagram (`carousel_media`), TikTok (`image_post_info.images`) and X
   * (`extended_entities.media`) can return more than one; every other platform's mapper fills
   * exactly one item from the fields it already had.
   */
  items?: MediaItem[];

  /**
   * OPTIONAL, and only some platforms fill it. It exists because the market corpus needs more than
   * a thumbnail and a like count, and all of it arrives in the same already paid-for response — the
   * profile endpoint was returning it and the mapper was dropping it on the floor.
   *
   * `videoUrl` and `captionsUrl` are SIGNED and SHORT-LIVED (the caption url carries its own
   * `expire`). Read them in the run that fetched them; a stored link is a link that 403s later.
   */
  videoUrl?: string | null;
  /** The creator's country. Makes `publishedAt` interpretable — see `localHour` in market-metrics. */
  region?: string | null;
  soundId?: string | null;
  soundName?: string | null;
  /** WebVTT of TikTok's own auto-captions, when it made any. Timestamped, so the hook is readable. */
  captionsUrl?: string | null;
  captionsLang?: string | null;
  /** Format and reach — see migration 0192 for what each one answers. */
  durationMs?: number | null;
  hashtags?: string[];
  soundFrom?: string | null;
  createdByAi?: boolean | null;
  videoRatio?: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  shootMode?: string | null;
  videoUrlClean?: string | null;
};

export type Account = { username: string | null; profileUrl: string | null };

const isoFromUnix = (s: number | null | undefined): string | null =>
  s == null ? null : new Date((s > 1e12 ? s : s * 1000)).toISOString();
const isoFromString = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Loop pages until we run out, hit maxPages, or collect maxPosts. `fetchPage` gets the previous
// cursor (null on the first call) and returns this page plus the next cursor.
//
 // Cap organic history pulls. Insights / playbook / visual refs only need recent posts —
// fetching hundreds burns ScrapeCreators credits and request time for no product gain.
// Aligned with HISTORY_ARCHIVE_LIMIT (60 durable thumbs per brand).
const DEFAULT_MAX_PAGES = 3;
const DEFAULT_MAX_POSTS = 60;
async function collect(
  fetchPage: (cursor: string | null) => Promise<{ posts: NormalizedPost[]; next: string | null }>,
  maxPages: number,
  maxPosts: number
): Promise<NormalizedPost[]> {
  const out: NormalizedPost[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const { posts, next } = await fetchPage(cursor);
    out.push(...posts);
    if (out.length >= maxPosts || !next) break;
    cursor = next;
  }
  return out.slice(0, maxPosts);
}

// ---- per-platform fetchers ------------------------------------------------------------------
// Each returns the brand's posts for that platform, or [] if it can't run (missing handle, etc).

/** Una slide di Instagram: `media_type` 1 = foto, 2 = video (stesso codice usato sul post intero). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function instagramSlide(raw: any): MediaItem | null {
  const thumbnailUrl = raw.display_uri ?? raw.image_versions2?.candidates?.[0]?.url ?? null;
  const isVideo = raw.media_type === 2;
  const url = isVideo ? (raw.video_versions?.[0]?.url ?? null) : thumbnailUrl;
  if (!url) return null;
  return { type: isVideo ? 'video' : 'image', url, thumbnailUrl };
}

/** Un post normale ha una sola slide; `carousel_media` ne porta quante ce ne sono, nell'ordine ricevuto. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function instagramItems(p: any): MediaItem[] {
  if (Array.isArray(p.carousel_media) && p.carousel_media.length) {
    return p.carousel_media.map(instagramSlide).filter((x: MediaItem | null): x is MediaItem => x !== null);
  }
  const single = instagramSlide(p);
  return single ? [single] : [];
}

async function instagram(a: Account, maxPages: number, maxPosts: number): Promise<NormalizedPost[]> {
  if (!a.username) return [];
  return collect(
    async (cursor) => {
      const qs = new URLSearchParams({ handle: a.username! });
      if (cursor) qs.set('next_max_id', cursor);
      const data = await scfetch('GET', `/v2/instagram/user/posts?${qs}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (data.items ?? []).map((p: any) => {
        const items = instagramItems(p);
        return {
          externalId: String(p.pk ?? p.id),
          url: p.url ?? null,
          content: p.caption?.text ?? null,
          mediaType: p.media_type === 2 ? 'video' : 'image',
          thumbnailUrl: items[0]?.thumbnailUrl ?? p.display_uri ?? p.image_versions2?.candidates?.[0]?.url ?? null,
          items,
          // The clip itself, which this mapper dropped for as long as it existed. Measured on
          // `lovable.dev`: 9 of 12 posts are media_type 2 and every one of them carries three
          // `video_versions`. Without this every Instagram video reached the archive as its cover —
          // still frame, no motion, and nothing downstream could tell that from a post that never had
          // a clip. Same class of bug as region and captions in migration 0192: the field was in the
          // response we already paid for.
          videoUrl: p.video_versions?.[0]?.url ?? null,
          durationMs: p.video_duration ? Math.round(Number(p.video_duration) * 1000) : null,
          publishedAt: isoFromUnix(p.taken_at),
          metrics: { likes: num(p.like_count), comments: num(p.comment_count) }
        };
      }) as NormalizedPost[];
      return { posts, next: data.more_available ? (data.next_max_id ?? null) : null };
    },
    maxPages,
    maxPosts
  );
}

/** Un post-foto TikTok (`image_post_info.images`) è già un carosello — ogni slide è un'immagine. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tiktokItems(v: any): MediaItem[] {
  const images = v.image_post_info?.images;
  if (Array.isArray(images) && images.length) {
    return images
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((img: any) => {
        const url = img.display_image?.url_list?.[0] ?? null;
        return url ? ({ type: 'image', url, thumbnailUrl: url } as MediaItem) : null;
      })
      .filter((x: MediaItem | null): x is MediaItem => x !== null);
  }
  const thumbnailUrl = v.video?.dynamic_cover?.url_list?.[0] ?? v.video?.cover?.url_list?.[0] ?? null;
  const url = v.video?.play_addr?.url_list?.[0] ?? v.video?.download_addr?.url_list?.[0] ?? null;
  return url ? [{ type: 'video', url, thumbnailUrl }] : [];
}

async function tiktok(a: Account, maxPages: number, maxPosts: number): Promise<NormalizedPost[]> {
  if (!a.username) return [];
  return collect(
    async (cursor) => {
      const qs = new URLSearchParams({ handle: a.username!, sort_by: 'latest' });
      if (cursor) qs.set('max_cursor', cursor);
      const data = await scfetch('GET', `/v3/tiktok/profile/videos?${qs}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (data.aweme_list ?? []).map((v: any) => {
      const items = tiktokItems(v);
      return {
        externalId: String(v.aweme_id),
        url: v.share_url ?? null,
        content: v.desc ?? null,
        mediaType: (v.image_post_info?.images?.length ? 'image' : 'video') as 'image' | 'video',
        thumbnailUrl: items[0]?.thumbnailUrl ?? v.video?.dynamic_cover?.url_list?.[0] ?? v.video?.cover?.url_list?.[0] ?? null,
        items,
        publishedAt: isoFromUnix(v.create_time),
        metrics: {
          views: num(v.statistics?.play_count),
          likes: num(v.statistics?.digg_count),
          comments: num(v.statistics?.comment_count),
          shares: num(v.statistics?.share_count),
          saves: num(v.statistics?.collect_count)
        },
        // Measured over 30 videos across 3 profiles: 30/30 carry a play_addr and a region, 8/30
        // carry auto-captions. The video url is the one that matters — without it the judge cannot
        // watch a single post out of an account's history, and that is where the breakout posts
        // live, next to the ordinary ones that make the comparison worth anything.
        videoUrl:
          v.video?.play_addr?.url_list?.[0] ?? v.video?.download_addr?.url_list?.[0] ?? null,
        region: v.region ? String(v.region).toUpperCase() : null,
        soundId: v.music?.id ? String(v.music.id) : null,
        soundName: v.music?.title ? String(v.music.title) : null,
        captionsUrl: v.video?.cla_info?.caption_infos?.[0]?.url ?? null,
        captionsLang: v.video?.cla_info?.caption_infos?.[0]?.language_code ?? null,
        durationMs: num(v.video?.duration),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hashtags: (v.text_extra ?? [])
          .map((t: any) => String(t?.hashtag_name ?? '').replace(/^#/, '').toLowerCase())
          .filter((h: string) => h),
        soundFrom: v.music_selected_from ? String(v.music_selected_from) : null,
        createdByAi:
          typeof v.aigc_info?.created_by_ai === 'boolean' ? v.aigc_info.created_by_ai : null,
        videoRatio: v.video?.ratio ? String(v.video.ratio) : null,
        videoWidth: num(v.video?.width),
        videoHeight: num(v.video?.height),
        shootMode: v.shoot_tab_name ? String(v.shoot_tab_name) : null,
        videoUrlClean: v.video?.download_no_watermark_addr?.url_list?.[0] ?? null
      };
      }) as NormalizedPost[];
      return { posts, next: data.has_more && data.max_cursor ? String(data.max_cursor) : null };
    },
    maxPages,
    maxPosts
  );
}

// X/Twitter returns ~100 popular tweets in a single shot — no cursor.
/**
 * Pick which rendition of an X video to download.
 *
 * The variant list holds an HLS playlist and four MP4s — measured on @uber: no bitrate on the
 * `application/x-mpegURL` entry, then 632k, 950k, 2176k and 10368k. Two rules fall out:
 *
 *   MP4 ONLY. The HLS entry is a playlist, not a file; the archiver checks the content type and
 *   would reject it as unsupported, which reads as "this tweet had no video" — the worst kind of
 *   wrong, because it is indistinguishable from the truth.
 *
 *   NOT THE BIGGEST. The 10Mbps master is the source rendition, and everything we do with it is
 *   downscaled to 360px for a hover preview. Paying five times the bytes for detail that is thrown
 *   away in the first ffmpeg filter is the definition of waste, so the cap takes the best rendition
 *   that is still a delivery format rather than a master.
 */
export function bestTwitterVariant(variants: unknown, maxBitrate = 3_000_000): string | null {
  if (!Array.isArray(variants)) return null;
  const mp4 = variants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((v: any) => String(v?.content_type ?? '') === 'video/mp4' && v?.url)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((v: any) => ({ url: String(v.url), bitrate: Number(v.bitrate) || 0 }))
    .sort((a, b) => a.bitrate - b.bitrate);
  if (!mp4.length) return null;
  const capped = mp4.filter((v) => v.bitrate <= maxBitrate);
  // Everything over the cap → take the smallest, which is still better than the master.
  return (capped.length ? capped[capped.length - 1] : mp4[0]).url;
}

/** Ogni entry di `extended_entities.media` è una slide — una sola per un tweet normale, più di una per una galleria. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function twitterItems(media: any[]): MediaItem[] {
  return media
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => {
      const isClip = m?.type === 'video' || m?.type === 'animated_gif';
      const thumbnailUrl = m?.media_url_https ?? null;
      const url = isClip ? bestTwitterVariant(m?.video_info?.variants) : thumbnailUrl;
      if (!url) return null;
      return { type: isClip ? 'video' : 'image', url, thumbnailUrl } as MediaItem;
    })
    .filter((x): x is MediaItem => x !== null);
}

async function twitter(a: Account): Promise<NormalizedPost[]> {
  if (!a.username) return [];
  const data = await scfetch('GET', `/v1/twitter/user-tweets?handle=${encodeURIComponent(a.username)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.tweets ?? []).map((t: any) => {
    const lg = t.legacy ?? {};
    const mediaList = lg.extended_entities?.media ?? [];
    const media = mediaList[0];
    const items = twitterItems(mediaList);
    // `type` is 'photo' | 'video' | 'animated_gif'. It was ignored, so every video tweet arrived
    // labelled 'image' — measured on @uber: 7 of 17 tweets are video, 6 photo, 4 text.
    const isClip = media?.type === 'video' || media?.type === 'animated_gif';
    return {
      externalId: String(t.rest_id ?? lg.id_str),
      url: t.url ?? (lg.id_str ? `https://x.com/${a.username}/status/${lg.id_str}` : null),
      content: lg.full_text ?? null,
      mediaType: isClip ? 'video' : media ? 'image' : 'text',
      thumbnailUrl: items[0]?.thumbnailUrl ?? media?.media_url_https ?? null,
      items,
      videoUrl: isClip ? bestTwitterVariant(media?.video_info?.variants) : null,
      durationMs: media?.video_info?.duration_millis ? num(media.video_info.duration_millis) : null,
      publishedAt: isoFromString(lg.created_at),
      metrics: {
        likes: num(lg.favorite_count),
        shares: num(lg.retweet_count),
        comments: num(lg.reply_count)
      }
    } as NormalizedPost;
  });
}

// Threads exposes only the last ~20-30 posts, single page.
/** Un post con una sola foto o clip: `items` è lo stesso singolo elemento che `thumbnailUrl` già descrive. */
function singleItem(mediaType: 'image' | 'video' | 'text' | null, thumbnailUrl: string | null): MediaItem[] {
  return mediaType && mediaType !== 'text' && thumbnailUrl ? [{ type: mediaType, url: thumbnailUrl, thumbnailUrl }] : [];
}

async function threads(a: Account): Promise<NormalizedPost[]> {
  if (!a.username) return [];
  const data = await scfetch('GET', `/v1/threads/user/posts?handle=${encodeURIComponent(a.username)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.posts ?? []).map((p: any) => {
    const mediaType = p.image_versions2?.candidates?.length ? 'image' : 'text';
    const thumbnailUrl = p.image_versions2?.candidates?.[0]?.url ?? null;
    return {
      externalId: String(p.pk ?? p.id),
      url: p.url ?? null,
      content: p.caption?.text ?? null,
      mediaType,
      thumbnailUrl,
      items: singleItem(mediaType, thumbnailUrl),
      publishedAt: isoFromUnix(p.taken_at),
      metrics: {
        likes: num(p.like_count),
        comments: num(p.text_post_app_info?.direct_reply_count)
      }
    };
  }) as NormalizedPost[];
}

// Facebook needs the profile URL (or pageId). We use profile_url, else build it from username.
async function facebook(a: Account, maxPages: number, maxPosts: number): Promise<NormalizedPost[]> {
  const url = a.profileUrl ?? (a.username ? `https://www.facebook.com/${a.username}` : null);
  if (!url) return [];
  return collect(
    async (cursor) => {
      const qs = new URLSearchParams({ url });
      if (cursor) qs.set('cursor', cursor);
      const data = await scfetch('GET', `/v1/facebook/profile/posts?${qs}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (data.posts ?? []).map((p: any) => {
        const mediaType = (p.videoDetails ? 'video' : p.text ? 'text' : 'image') as 'image' | 'video' | 'text';
        const thumbnailUrl = p.videoDetails?.thumbnailUrl ?? null;
        return {
          externalId: String(p.id),
          url: p.url ?? p.permalink ?? null,
          content: p.text ?? null,
          mediaType,
          thumbnailUrl,
          items: singleItem(mediaType, thumbnailUrl),
          publishedAt: isoFromUnix(p.publishTime),
          metrics: {
            likes: num(p.reactionCount),
            comments: num(p.commentCount),
            views: num(p.videoViewCount)
          }
        };
      }) as NormalizedPost[];
      return { posts, next: data.cursor ?? null };
    },
    maxPages,
    maxPosts
  );
}

// YouTube: handle works (e.g. "@channel" or the bare handle); cursor = continuationToken.
async function youtube(a: Account, maxPages: number, maxPosts: number): Promise<NormalizedPost[]> {
  if (!a.username) return [];
  return collect(
    async (cursor) => {
      const qs = new URLSearchParams({ handle: a.username!, sort: 'latest' });
      if (cursor) qs.set('continuationToken', cursor);
      const data = await scfetch('GET', `/v1/youtube/channel-videos?${qs}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (data.videos ?? []).map((v: any) => ({
        externalId: String(v.id),
        url: v.url ?? (v.id ? `https://www.youtube.com/watch?v=${v.id}` : null),
        content: v.title ?? null,
        mediaType: 'video' as const,
        thumbnailUrl: v.thumbnail ?? null,
        items: singleItem('video', v.thumbnail ?? null),
        publishedAt: isoFromString(v.publishedTime),
        metrics: { views: num(v.viewCountInt) }
      })) as NormalizedPost[];
      return { posts, next: data.continuationToken ?? null };
    },
    maxPages,
    maxPosts
  );
}

// LinkedIn only has a COMPANY posts endpoint, paginated by page number (max 7). Needs the company
// page URL — works for brand pages, silently yields nothing for personal profiles.
async function linkedin(a: Account, _maxPages: number, maxPosts: number): Promise<NormalizedPost[]> {
  const url = a.profileUrl ?? (a.username ? `https://www.linkedin.com/company/${a.username}` : null);
  if (!url) return [];
  const out: NormalizedPost[] = [];
  for (let page = 1; page <= 7 && out.length < maxPosts; page++) {
    const data = await scfetch('GET', `/v1/linkedin/company/posts?url=${encodeURIComponent(url)}&page=${page}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = (data.posts ?? []).map((p: any) => {
      const thumbnailUrl = p.thumbnail ?? p.image ?? null;
      return {
        externalId: String(p.id),
        url: p.url ?? null,
        content: p.text ?? null,
        mediaType: 'text' as const,
        thumbnailUrl,
        items: singleItem(thumbnailUrl ? 'image' : 'text', thumbnailUrl),
        publishedAt: isoFromString(p.datePublished),
        metrics: { likes: num(p.reactionCount ?? p.likeCount), comments: num(p.commentCount) }
      };
    }) as NormalizedPost[];
    if (!posts.length) break;
    out.push(...posts);
  }
  return out.slice(0, maxPosts);
}

const FETCHERS: Record<string, (a: Account, maxPages: number, maxPosts: number) => Promise<NormalizedPost[]>> = {
  instagram,
  tiktok,
  x: twitter,
  threads,
  facebook,
  youtube,
  linkedin
};

export type FetchLimits = { maxPages?: number; maxPosts?: number };

// Raw API fetch (no cache). Throws on HTTP error so callers can record per-platform failures.
export async function fetchProfileHistory(
  platform: string,
  account: Account,
  limits: FetchLimits = {}
): Promise<NormalizedPost[]> {
  const fn = FETCHERS[platform];
  if (!fn) return [];
  return fn(account, limits.maxPages ?? DEFAULT_MAX_PAGES, limits.maxPosts ?? DEFAULT_MAX_POSTS);
}

// ---- single post/video by URL -----------------------------------------------------------------
//
// `fetchProfileHistory` above takes a HANDLE and returns everything it posted; this takes a POST
// URL and returns that one post — for a link pasted into a node, not an account. One endpoint per
// platform, 1 credit each, verified live against api.scrapecreators.com on 2026-09-27:
//   instagram GET /v1/instagram/post?url=       tiktok    GET /v2/tiktok/video?url=
//   x         GET /v1/twitter/tweet?url=         threads   GET /v1/threads/post?url=
//   facebook  GET /v1/facebook/post?url=         youtube   GET /v1/youtube/video?url=
// linkedin has no single-post endpoint (only company-posts, same as fetchProfileHistory above).

/** `pickString` reads nested paths too — Instagram's fields can sit one or two levels deep. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickPath(obj: any, path: string): unknown {
  return path.split('.').reduce((at, key) => (at && typeof at === 'object' ? at[key] : undefined), obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickStringPath(obj: any, paths: string[]): string | null {
  for (const path of paths) {
    const v = pickPath(obj, path);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickNumberPath(obj: any, paths: string[]): number | null {
  for (const path of paths) {
    const v = pickPath(obj, path);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function instagramSingle(raw: any, url: string): NormalizedPost {
  // The real response wraps the post under `data.xdt_shortcode_media` — verified live against
  // api.scrapecreators.com/v1/instagram/post on 2026-09-27, not the flatter shape the docs summary
  // implied. `created_at`/`taken_at_timestamp` are both unix SECONDS, `created_at` as a string.
  const data = raw.data?.xdt_shortcode_media ?? raw.xdt_shortcode_media ?? raw;
  const isVideo = data.is_video === true || data.product_type === 'clips';
  const thumbnailUrl = pickStringPath(data, ['display_url', 'thumbnail_src']);
  const videoUrl = isVideo ? pickStringPath(data, ['video_url']) : null;
  return {
    externalId: String(data.id ?? data.shortcode ?? url),
    url,
    content: pickStringPath(data, ['edge_media_to_caption.edges.0.node.text', 'caption']),
    mediaType: isVideo ? 'video' : 'image',
    thumbnailUrl,
    videoUrl,
    items: thumbnailUrl ? [{ type: isVideo ? 'video' : 'image', url: videoUrl ?? thumbnailUrl, thumbnailUrl }] : [],
    publishedAt: isoFromUnix(Number(data.created_at) || data.taken_at_timestamp),
    metrics: {
      likes: pickNumberPath(data, ['edge_media_preview_like.count', 'like_count']),
      comments: pickNumberPath(data, ['comment_count', 'edge_media_to_parent_comment.count']),
      views: pickNumberPath(data, ['video_play_count'])
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tiktokSingle(data: any, url: string): NormalizedPost {
  const v = data.aweme_detail ?? data;
  const items = tiktokItems(v);
  return {
    externalId: String(v.aweme_id ?? url),
    url: v.share_url ?? url,
    content: v.desc ?? null,
    mediaType: (v.image_post_info?.images?.length ? 'image' : 'video') as 'image' | 'video',
    thumbnailUrl: items[0]?.thumbnailUrl ?? v.video?.dynamic_cover?.url_list?.[0] ?? null,
    videoUrl: v.video?.play_addr?.url_list?.[0] ?? v.video?.download_addr?.url_list?.[0] ?? null,
    items,
    publishedAt: isoFromUnix(v.create_time),
    metrics: {
      views: num(v.statistics?.play_count),
      likes: num(v.statistics?.digg_count),
      comments: num(v.statistics?.comment_count),
      shares: num(v.statistics?.share_count),
      saves: num(v.statistics?.collect_count)
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function twitterSingle(data: any, url: string): NormalizedPost {
  const lg = data.legacy ?? data;
  const mediaList = lg.extended_entities?.media ?? [];
  const items = twitterItems(mediaList);
  const media = mediaList[0];
  const isClip = media?.type === 'video' || media?.type === 'animated_gif';
  return {
    externalId: String(data.rest_id ?? lg.id_str ?? url),
    url,
    content: lg.full_text ?? data.text ?? null,
    mediaType: isClip ? 'video' : media ? 'image' : 'text',
    thumbnailUrl: items[0]?.thumbnailUrl ?? media?.media_url_https ?? null,
    videoUrl: isClip ? bestTwitterVariant(media?.video_info?.variants) : null,
    items,
    publishedAt: isoFromString(lg.created_at ?? data.created_at),
    metrics: {
      likes: num(lg.favorite_count ?? data.favorite_count),
      shares: num(lg.retweet_count ?? data.retweet_count),
      comments: num(lg.reply_count ?? data.reply_count)
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function threadsSingle(data: any, url: string): NormalizedPost {
  const p = data.thread_items?.[0]?.post ?? data;
  const mediaType = p.image_versions2?.candidates?.length ? 'image' : 'text';
  const thumbnailUrl = p.image_versions2?.candidates?.[0]?.url ?? null;
  return {
    externalId: String(p.pk ?? p.id ?? url),
    url,
    content: p.caption?.text ?? null,
    mediaType,
    thumbnailUrl,
    items: singleItem(mediaType, thumbnailUrl),
    publishedAt: isoFromUnix(p.taken_at),
    metrics: {
      likes: num(p.like_count),
      comments: num(p.text_post_app_info?.direct_reply_count)
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function facebookSingle(data: any, url: string): NormalizedPost {
  // Flat response, no envelope — verified live on 2026-09-27. Video lives under `video.sd_url`/
  // `hd_url` (no `videoDetails`), the still image under `image_url` or the first of `images`.
  const isVideo = !!data.video?.hd_url || !!data.video?.sd_url;
  const mediaType = (isVideo ? 'video' : data.image_url || data.images?.length ? 'image' : 'text') as 'image' | 'video' | 'text';
  const thumbnailUrl = data.video?.thumbnail ?? data.thumbnail ?? data.image_url ?? data.images?.[0] ?? null;
  const videoUrl = isVideo ? (data.video?.hd_url ?? data.video?.sd_url ?? null) : null;
  return {
    externalId: String(data.post_id ?? data.id ?? url),
    url: data.url ?? url,
    content: data.description ?? data.text ?? null,
    mediaType,
    thumbnailUrl,
    videoUrl,
    items: thumbnailUrl ? [{ type: isVideo ? 'video' : 'image', url: videoUrl ?? thumbnailUrl, thumbnailUrl }] : [],
    publishedAt: isoFromString(data.creation_time),
    metrics: {
      likes: num(data.like_count),
      comments: num(data.comment_count),
      views: num(data.view_count)
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function youtubeSingle(data: any, url: string): NormalizedPost {
  return {
    externalId: String(data.id ?? url),
    url: data.url ?? url,
    content: data.title ?? null,
    mediaType: 'video',
    thumbnailUrl: data.thumbnail ?? null,
    items: singleItem('video', data.thumbnail ?? null),
    durationMs: num(data.durationMs),
    publishedAt: isoFromString(data.publishDate),
    metrics: {
      views: num(data.viewCountInt),
      likes: num(data.likeCountInt),
      comments: num(data.commentCountInt)
    }
  };
}

const SINGLE_POST_ENDPOINTS: Record<string, string> = {
  instagram: '/v1/instagram/post',
  tiktok: '/v2/tiktok/video',
  x: '/v1/twitter/tweet',
  threads: '/v1/threads/post',
  facebook: '/v1/facebook/post',
  youtube: '/v1/youtube/video'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SINGLE_POST_MAPPERS: Record<string, (data: any, url: string) => NormalizedPost> = {
  instagram: instagramSingle,
  tiktok: tiktokSingle,
  x: twitterSingle,
  threads: threadsSingle,
  facebook: facebookSingle,
  youtube: youtubeSingle
};

export function isSinglePostPlatform(platform: string): boolean {
  return platform in SINGLE_POST_ENDPOINTS;
}

// Fetch exactly one post/video by its public URL. Throws on HTTP error (a 404 is a real "post not
// found", not zero results to swallow) so callers can tell it apart from every other failure.
export async function fetchSinglePost(platform: string, url: string): Promise<NormalizedPost> {
  const path = SINGLE_POST_ENDPOINTS[platform];
  if (!path) {
    throw new Error(`single post fetch not supported for platform: ${platform}`);
  }
  const data = await scfetch('GET', `${path}?url=${encodeURIComponent(url)}`);
  return SINGLE_POST_MAPPERS[platform](data, url);
}

// ---- profile identity (for People detection from socials) -----------------------------------
//
// A personal social handle (e.g. a founder's Instagram) is full of the person's own photos. We use
// it to PROPOSE a brand "person": the display name + a face photo (the profile picture, with recent
// post thumbnails as extra reference images). Best-effort throughout — providers/paths vary, so we
// parse defensively and ALWAYS fall back to post thumbnails (which, on a personal account, are
// selfies) when the profile endpoint is unavailable or returns no picture.

export type SocialProfile = {
  platform: string;
  username: string;
  name: string; // display/full name when found, else the bare handle
  photoUrl: string | null; // best face = the profile picture (or first post thumbnail)
  thumbs: string[]; // recent post thumbnails — extra reference photos for the person model
};

// Profile-info endpoint per platform (name + profile picture). Only the platforms whose accounts are
// typically PERSONAL; brand-only surfaces (facebook page, linkedin company, youtube channel) are
// omitted — they don't represent a single face.
const PROFILE_ENDPOINTS: Record<string, (u: string) => string> = {
  instagram: (u) => `/v1/instagram/profile?handle=${encodeURIComponent(u)}`,
  tiktok: (u) => `/v1/tiktok/profile?handle=${encodeURIComponent(u)}`,
  threads: (u) => `/v1/threads/profile?handle=${encodeURIComponent(u)}`,
  x: (u) => `/v1/twitter/profile?handle=${encodeURIComponent(u)}`
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickString(obj: any, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// Resolve a handle into a proposable person: { name, photoUrl, thumbs }. Never throws.
export async function fetchSocialProfile(platform: string, username: string): Promise<SocialProfile> {
  const handle = String(username ?? '').trim().replace(/^@/, '');
  const out: SocialProfile = { platform, username: handle, name: handle, photoUrl: null, thumbs: [] };
  if (!handle) return out;

  // 1) Profile endpoint → display name + profile picture (the cleanest face). Defensive parsing:
  //    different providers nest the user object differently and name the fields differently.
  const ep = PROFILE_ENDPOINTS[platform];
  if (ep) {
    try {
      const data = await scfetch('GET', ep(handle));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const root: any = data?.data?.user ?? data?.user ?? data?.profile ?? data ?? {};
      out.name = pickString(root, ['full_name', 'fullName', 'name', 'nickname', 'display_name']) || handle;
      out.photoUrl = pickString(root, [
        'profile_pic_url_hd', 'profile_pic_url', 'profilePicUrl', 'profilePicUrlHD',
        'avatarLarger', 'avatarMedium', 'avatar', 'avatar_url',
        'profile_image_url_https', 'profile_image_url', 'image'
      ]);
    } catch {
      // fall through to thumbnails
    }
  }

  // 2) Recent post thumbnails: extra reference photos, AND the photo fallback when the profile
  //    endpoint had no picture (or doesn't exist for this platform).
  //
  //    LIGHT probe only (1 page / ≤12 posts). The onboarding `/people/from-socials` route is a
  //    synchronous browser fetch with a ~30–60s platform budget — a FULL history scrape here
  //    (12 pages / 300 posts) routinely outlives the client connection and surfaces as
  //    "Failed to fetch". We also must NOT write a thin result into scrapecreators_cache: that
  //    near-permanent row is reused by the whole pipeline, so a 12-post probe would poison it.
  //    Prefer a fresh existing cache row when present (post-checkout sync may already have
  //    warmed it); otherwise do an uncached 1-page fetch.
  try {
    const key = handleKey({ username: handle, profileUrl: null });
    let posts: NormalizedPost[] = [];
    if (key) {
      const admin = createAdminClient();
      const { data: cached } = await admin
        .from('scrapecreators_cache')
        .select('posts, fetched_at')
        .eq('platform', platform)
        .eq('handle', key)
        .maybeSingle();
      // MEDIA_FRESH_MS: these thumbs become the person's imported reference photos — a stale
      // cache row would hand back dead signed CDN URLs and the import would silently drop them.
      const fresh =
        !!cached && Date.now() - new Date(cached.fetched_at).getTime() < MEDIA_FRESH_MS;
      if (fresh) {
        posts = (cached!.posts ?? []) as NormalizedPost[];
      } else {
        posts = await fetchProfileHistory(platform, { username: handle, profileUrl: null }, {
          maxPages: 1,
          maxPosts: 12
        });
      }
    }
    out.thumbs = posts.map((p) => p.thumbnailUrl).filter((u): u is string => !!u).slice(0, 8);
    if (!out.photoUrl && out.thumbs.length) out.photoUrl = out.thumbs[0];
  } catch {
    // best-effort — a bare name with no photo is still a valid (if weak) candidate
  }

  return out;
}

// ---- caching layer --------------------------------------------------------------------------

// How old a cache row may be when its MEDIA URLs still need to be alive. Signed platform-CDN
// thumbnails (Instagram especially) die within days; text/metrics stay valid much longer. Matches
// the Studio sync staleness window.
export const MEDIA_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

// Stable cache key for a profile. Username when present, else the profile URL. Lowercased so the
// same handle in different casing hits the same cache row.
function handleKey(account: Account): string | null {
  const h = (account.username ?? account.profileUrl ?? '').trim().toLowerCase();
  return h || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

// Cached history for one profile. Returns cached posts when a fresh-enough row exists, otherwise
// fetches from scrapecreators and stores the result. Caches successful calls only (including empty
// results — a private/empty profile shouldn't be re-queried). `maxAgeMs` undefined ⇒ any age is
// fresh (near-permanent); pass a window to force a refetch of stale rows.
export async function getCachedHistory(
  admin: AdminClient,
  platform: string,
  account: Account,
  opts: { maxAgeMs?: number } & FetchLimits = {}
): Promise<NormalizedPost[]> {
  const handle = handleKey(account);
  if (!handle) return [];

  const { data: cached } = await admin
    .from('scrapecreators_cache')
    .select('posts, fetched_at')
    .eq('platform', platform)
    .eq('handle', handle)
    .maybeSingle();

  if (cached) {
    const fresh =
      opts.maxAgeMs == null || Date.now() - new Date(cached.fetched_at).getTime() < opts.maxAgeMs;
    if (fresh) return (cached.posts ?? []) as NormalizedPost[];
  }

  const posts = await fetchProfileHistory(platform, account, opts); // throws ⇒ no cache write
  await admin.from('scrapecreators_cache').upsert(
    {
      platform,
      handle,
      posts,
      post_count: posts.length,
      fetched_at: new Date().toISOString()
    },
    { onConflict: 'platform,handle' }
  );
  return posts;
}

// ---- per-brand sync -------------------------------------------------------------------------

export type ScrapeTarget = { platform: string; username: string | null; profileUrl: string | null };

// The profiles to scrape for a brand: the handles it declared (brand_social_handles) plus any
// Zernio-connected account that carries a username. Deduped by platform+username.
export async function getBrandScrapeTargets(
  supabase: SupabaseClient,
  brandId: string
): Promise<ScrapeTarget[]> {
  const [{ data: handles }, { data: accounts }] = await Promise.all([
    supabase
      .from('brand_social_handles')
      .select('platform, username, profile_url')
      .eq('brand_id', brandId),
    supabase
      .from('social_accounts')
      .select('platform, username, profile_url, status')
      .eq('brand_id', brandId)
  ]);

  const out: ScrapeTarget[] = [];
  const seen = new Set<string>();
  const add = (platform: string | null, username: string | null, profileUrl: string | null) => {
    if (!platform || (!username && !profileUrl)) return;
    const key = `${platform}:${(username ?? profileUrl ?? '').toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ platform, username, profileUrl });
  };

  for (const h of handles ?? []) add(h.platform, h.username, h.profile_url);
  for (const a of accounts ?? []) if (a.status !== 'disconnected') add(a.platform, a.username, a.profile_url);
  return out;
}

function toRows(brandId: string, platform: string, posts: NormalizedPost[]) {
  const syncedAt = new Date().toISOString();
  return posts.map((p) => ({
    brand_id: brandId,
    source: 'scrapecreators',
    external_post_id: `${platform}:${p.externalId}`,
    platform,
    platform_post_url: p.url,
    content: p.content,
    media_type: p.mediaType,
    thumbnail_url: p.thumbnailUrl,
    media_items: null,
    published_at: p.publishedAt,
    metrics: p.metrics,
    synced_at: syncedAt
  }));
}

export type ScrapeSyncResult = {
  synced: number;
  accounts: number; // profiles we attempted
  errors: { platform: string; message: string }[];
};

// Pull every declared profile's history (via cache) into social_post_history for the brand.
// Best-effort per platform: one profile failing never aborts the others.
export async function materializeBrandHistory(
  supabase: SupabaseClient,
  brandId: string,
  targets: ScrapeTarget[],
  opts: { maxAgeMs?: number } & FetchLimits = {}
): Promise<ScrapeSyncResult> {
  const admin = createAdminClient();
  let synced = 0;
  const errors: { platform: string; message: string }[] = [];

  // Platforms in parallel — ScrapeCreators is fast per account; sequential 5-platform loops
  // were stacking latency for no reason on early create.
  const perPlatform = await Promise.all(
    targets.map(async (t) => {
      try {
        const posts = await getCachedHistory(
          admin,
          t.platform,
          { username: t.username, profileUrl: t.profileUrl },
          opts
        );
        if (!posts.length) return 0;
        const rows = toRows(brandId, t.platform, posts);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase
          .from('social_post_history')
          .upsert(rows as any, { onConflict: 'brand_id,source,external_post_id' });
        if (error) {
          errors.push({ platform: t.platform, message: error.message });
          return 0;
        }
        return rows.length;
      } catch (e) {
        errors.push({ platform: t.platform, message: e instanceof Error ? e.message : 'fetch failed' });
        return 0;
      }
    })
  );
  synced = perPlatform.reduce((a, n) => a + n, 0);

  // Archive thumbnails AFTER posts are stored — but never let CDN downloads own the scrape budget.
  // Bounded concurrency: Promise.all(60) with slow Instagram CDNs was burning the whole 120s
  // onboarding create window even when ScrapeCreators itself was already done.
  if (synced > 0) await archiveHistoryThumbnails(supabase, brandId).catch(swallow('archiveHistoryThumbnails failed'));
  return { synced, accounts: targets.length, errors };
}

// How many history thumbnails to keep durably archived per brand (newest first). Enough for the
// visual-style read (10), the playbook (6), the mood refs (3) and the Studio history grid.
const HISTORY_ARCHIVE_LIMIT = 60;
const HISTORY_ARCHIVE_CONCURRENCY = 6;

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

// Download the not-yet-archived thumbnails of a brand's history into the brand-knowledge bucket
// and stamp thumbnail_path on each row. Paths follow the bucket's RLS convention
// ({ownerId}/{brandId}/…) so the owner's client can sign them too. Idempotent (rows with a path
// are skipped; the path key is the url hash). Best-effort per row — a dead link just stays URL-only.
export async function archiveHistoryThumbnails(supabase: SupabaseClient, brandId: string): Promise<number> {
  const { data: brand } = await supabase.from('brands').select('org_id').eq('id', brandId).maybeSingle();
  const { data: org } = brand?.org_id
    ? await supabase.from('organizations').select('owner_id').eq('id', brand.org_id).maybeSingle()
    : { data: null };
  const ownerId = org?.owner_id as string | undefined;
  if (!ownerId) return 0;

  const { data: rows } = await supabase
    .from('social_post_history')
    .select('id, thumbnail_url')
    .eq('brand_id', brandId)
    .not('thumbnail_url', 'is', null)
    .is('thumbnail_path', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(HISTORY_ARCHIVE_LIMIT);
  if (!rows?.length) return 0;

  let archived = 0;
  await mapPool(rows, HISTORY_ARCHIVE_CONCURRENCY, async (r) => {
    const url = String(r.thumbnail_url ?? '');
    const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
    const path = await archiveImageToBucket(supabase, `${ownerId}/${brandId}/history/${key}.jpg`, url);
    if (path) {
      await supabase.from('social_post_history').update({ thumbnail_path: path }).eq('id', r.id);
      archived++;
    }
  });
  return archived;
}

// Studio "Sync from socials": refresh history for all declared profiles. Refetches profiles whose
// cache is older than STALE_MS; younger ones are served from cache to save credits.
const SYNC_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export async function syncBrandPostHistoryFromSocials(
  supabase: SupabaseClient,
  brand: { id: string }
): Promise<ScrapeSyncResult> {
  const targets = await getBrandScrapeTargets(supabase, brand.id);
  if (!targets.length) return { synced: 0, accounts: 0, errors: [] };
  return materializeBrandHistory(supabase, brand.id, targets, {
    maxAgeMs: SYNC_STALE_MS,
    maxPages: DEFAULT_MAX_PAGES,
    maxPosts: DEFAULT_MAX_POSTS
  });
}

// Make sure a brand's organic history is materialized BEFORE anything judges it. Brands created
// before the strategy layers often declared their handles but never materialized history into
// social_post_history — which made the 0→1 detection brand them as "starting from zero" (and
// left Analytics' organic section empty) even with thriving socials. Cache-first via the
// permanent scrapecreators_cache, so for handles already scraped at onboarding this costs zero
// API credits. Returns the (possibly refreshed) post count; best-effort, never throws.
export async function ensureBrandHistory(
  supabase: SupabaseClient,
  brandId: string,
  minPosts = 10
): Promise<number> {
  const { count } = await supabase
    .from('social_post_history')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId);
  if ((count ?? 0) >= minPosts) return count ?? 0;
  try {
    const res = await syncBrandPostHistoryFromSocials(supabase, { id: brandId });
    if (res.synced > 0) {
      const { count: after } = await supabase
        .from('social_post_history')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId);
      return after ?? 0;
    }
  } catch (error) { swallow('count history rows', error); }
  return count ?? 0;
}

// ---- onboarding (no brand row yet) ----------------------------------------------------------

export type ScrapedPost = NormalizedPost & { platform: string };

// Scrape the declared handles for onboarding — before any brand exists. Light by default (few
// pages) to keep the preview snappy; everything is cached by handle, so the later brand-creation
// materialisation reuses it without spending more credits.
export async function scrapeForOnboarding(
  targets: ScrapeTarget[],
  limits: FetchLimits = { maxPages: 2, maxPosts: 40 }
): Promise<{ posts: ScrapedPost[]; errors: { platform: string; message: string }[] }> {
  const admin = createAdminClient();
  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        // MEDIA_FRESH_MS, not "any age": the posts' thumbnail URLs are SIGNED platform-CDN links
        // that die within days (verified: an 18-day-old Instagram cache row serves 403s), which
        // silently blanks every multimodal consumer (visual brief, playbook, competitor analysis,
        // person refs). Within one pipeline run everything is still a cache hit; a re-run weeks
        // later pays ONE refetch per handle — which it wants anyway for fresh metrics.
        const posts = await getCachedHistory(admin, t.platform, { username: t.username, profileUrl: t.profileUrl }, { ...limits, maxAgeMs: MEDIA_FRESH_MS });
        return { platform: t.platform, posts, error: null as string | null };
      } catch (e) {
        return { platform: t.platform, posts: [] as NormalizedPost[], error: e instanceof Error ? e.message : 'fetch failed' };
      }
    })
  );
  const posts: ScrapedPost[] = [];
  const errors: { platform: string; message: string }[] = [];
  for (const r of results) {
    if (r.error) errors.push({ platform: r.platform, message: r.error });
    for (const p of r.posts) posts.push({ ...p, platform: r.platform });
  }
  return { posts, errors };
}
