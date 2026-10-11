import type { Account, NormalizedPost } from '$lib/server/scrapecreators';
import { classifySocialInput, type ClassifiablePlatform } from '$lib/canvas/social-url-classifier';

export enum ItemKind {
  Image = 'image',
  Video = 'video',
  Carousel = 'carousel',
  Text = 'text'
}

export type SocialItem = {
  platform: ClassifiablePlatform;
  id: string;
  url: string | null;
  kind: ItemKind;
  caption: string | null;
  images: string[];
  video: string | null;
  seconds: number | null;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
};

export type ProfileTarget = { ok: true; platform: ClassifiablePlatform; account: Account } | { ok: false; error: string };

const MS_PER_SECOND = 1000;
const URLISH = /\//;

function kindOf(post: NormalizedPost, slides: number): ItemKind {
  if (slides > 1) {
    return ItemKind.Carousel;
  }
  if (post.mediaType === 'video') {
    return ItemKind.Video;
  }
  return post.mediaType === 'image' || post.thumbnailUrl ? ItemKind.Image : ItemKind.Text;
}

export function socialItem(platform: ClassifiablePlatform, post: NormalizedPost): SocialItem {
  const slides = post.items ?? [];
  const pictures = slides.flatMap((s) => {
    const picture = s.type === 'image' ? s.url : s.thumbnailUrl;
    return picture ? [picture] : [];
  });
  const metric = (k: string) => post.metrics[k] ?? null;
  return {
    platform,
    id: post.externalId,
    url: post.url,
    kind: kindOf(post, slides.length),
    caption: post.content,
    images: pictures.length ? pictures : post.thumbnailUrl ? [post.thumbnailUrl] : [],
    video: post.videoUrl ?? slides.find((s) => s.type === 'video')?.url ?? null,
    seconds: post.durationMs == null ? null : Math.round(post.durationMs / MS_PER_SECOND),
    publishedAt: post.publishedAt,
    likes: metric('likes'),
    comments: metric('comments'),
    views: metric('views')
  };
}

export function profileAccount(platform: ClassifiablePlatform, handle: string): ProfileTarget {
  const value = handle.trim();
  if (!URLISH.test(value)) {
    return { ok: true, platform, account: { username: value.replace(/^@/, ''), profileUrl: null } };
  }
  const classified = classifySocialInput(value);
  if (!classified.ok || classified.entry.kind !== 'profile') {
    return { ok: false, error: `not a profile: ${value}` };
  }
  return { ok: true, platform: classified.entry.platform, account: { username: classified.entry.handle, profileUrl: value } };
}
