export type SocialGet = (path: string) => Promise<unknown>;

export enum SocialPlatform {
  TikTok = 'tiktok',
  Instagram = 'instagram',
  YouTube = 'youtube'
}

export type Clip = {
  platform: SocialPlatform;
  id: string;
  url: string;
  caption: string | null;
  thumbnail: string | null;
  video: string | null;
  author: string | null;
  views: number | null;
  likes: number | null;
  seconds: number | null;
  publishedAt: string | null;
};

export type ClipsFound = { ok: true; clips: Clip[]; requests: number } | { ok: false; error: string; requests: number };

export const SOCIAL_MAX_CLIPS = 20;

type Raw = Record<string, unknown>;
type ClipFields = Omit<Clip, 'platform'>;
type Source = { path: string; list: string; clip: (raw: Raw) => ClipFields | null };

const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Raw) : {});
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const seconds = (v: unknown, perSecond = 1) => (count(v) === null ? null : Math.round((v as number) / perSecond));
const firstUrl = (v: unknown) => text(obj(v).url_list && (obj(v).url_list as unknown[])[0]);
const isoFromUnix = (v: unknown) => (count(v) === null ? null : new Date((v as number) * 1000).toISOString());
const MS_PER_SECOND = 1000;

function tiktokClip(item: Raw): ClipFields | null {
  const v = obj(item.aweme_info);
  const video = obj(v.video);
  const stats = obj(v.statistics);
  const id = text(v.aweme_id);
  const author = text(obj(v.author).unique_id);
  if (!id) {
    return null;
  }
  return {
    id,
    url: text(v.share_url)?.split('?')[0] ?? `https://www.tiktok.com/@${author ?? '_'}/video/${id}`,
    caption: text(v.desc),
    thumbnail: firstUrl(video.cover) ?? firstUrl(video.dynamic_cover),
    video: firstUrl(video.play_addr) ?? firstUrl(video.download_addr),
    author,
    views: count(stats.play_count),
    likes: count(stats.digg_count),
    seconds: seconds(video.duration, MS_PER_SECOND),
    publishedAt: isoFromUnix(v.create_time)
  };
}

function instagramClip(r: Raw): ClipFields | null {
  const id = text(r.id);
  const url = text(r.url);
  if (!id || !url) {
    return null;
  }
  return {
    id,
    url,
    caption: text(r.caption),
    thumbnail: text(r.thumbnail_src) ?? text(r.display_url),
    video: text(r.video_url),
    author: text(obj(r.owner).username),
    views: count(r.video_view_count),
    likes: count(r.like_count),
    seconds: seconds(r.video_duration),
    publishedAt: text(r.taken_at)
  };
}

function youtubeClip(v: Raw): ClipFields | null {
  const id = text(v.id);
  const url = text(v.url);
  if (!id || !url) {
    return null;
  }
  const channel = obj(v.channel);
  return {
    id,
    url,
    caption: text(v.title),
    thumbnail: text(v.thumbnail),
    video: null,
    author: text(channel.handle) ?? text(channel.title),
    views: count(v.viewCountInt),
    likes: null,
    seconds: seconds(v.lengthSeconds),
    publishedAt: text(v.publishedTime)
  };
}

const SOURCES: Record<SocialPlatform, Source> = {
  [SocialPlatform.TikTok]: { path: '/v1/tiktok/search/keyword', list: 'search_item_list', clip: tiktokClip },
  [SocialPlatform.Instagram]: { path: '/v2/instagram/reels/search', list: 'reels', clip: instagramClip },
  [SocialPlatform.YouTube]: { path: '/v1/youtube/search', list: 'videos', clip: youtubeClip }
};

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function socialSearch(get: SocialGet, platform: SocialPlatform, query: string, limit: number): Promise<ClipsFound> {
  const source = SOURCES[platform];
  const wanted = Math.min(Math.max(limit, 1), SOCIAL_MAX_CLIPS);
  let page: Raw;
  try {
    page = obj(await get(`${source.path}?${new URLSearchParams({ query })}`));
  } catch (e) {
    return { ok: false, error: `${platform} search failed: ${errorOf(e)}`, requests: 1 };
  }
  const raws = Array.isArray(page[source.list]) ? (page[source.list] as unknown[]) : [];
  const clips = raws.flatMap((r) => {
    const fields = source.clip(obj(r));
    return fields ? [{ platform, ...fields }] : [];
  });
  return { ok: true, clips: clips.slice(0, wanted), requests: 1 };
}
