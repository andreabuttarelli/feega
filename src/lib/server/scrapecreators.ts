import { env } from '$env/dynamic/private';
import { logAiCall } from '$lib/server/ai-log';

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
// org's credits like any AI call.
export const SCRAPECREATORS_COST_USD = 0.002;

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
// Each returns the posts for that platform, or [] if it can't run (missing handle, etc).

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
