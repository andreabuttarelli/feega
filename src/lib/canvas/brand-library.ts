import { staticMediaData, staticTextData, type FilledNodeDrag } from './drag-payload';
import { genNodeSize } from './gen-node';

export enum LibraryTab {
  Kit = 'kit',
  Products = 'products',
  Posts = 'posts',
  Ads = 'ads'
}

export const LIBRARY_TABS: LibraryTab[] = [LibraryTab.Kit, LibraryTab.Products, LibraryTab.Posts, LibraryTab.Ads];

export type LibraryMediaType = 'image' | 'video';

export type LibraryItem = {
  id: string;
  title: string;
  subtitle: string | null;
  assetId: string | null;
  mediaType: LibraryMediaType | null;
  group?: string;
};

export function libraryDrag(item: LibraryItem): FilledNodeDrag | null {
  if (item.assetId && item.mediaType) {
    return {
      type: item.mediaType,
      data: staticMediaData({ assetId: item.assetId, url: '', name: item.title, mimeType: `${item.mediaType}/*` }),
      ...genNodeSize(item.mediaType)
    };
  }

  const text = [item.title, item.subtitle].filter(Boolean).join('\n\n');
  return text ? { type: 'text', data: staticTextData(text), ...genNodeSize('text') } : null;
}

const VIDEO_HINT = /video|\.mp4|\.mov|\.webm/i;
const HTTP = /^https?:\/\//;

export function firstMedia(json: unknown, key = ''): { url: string; type: LibraryMediaType } | null {
  if (typeof json === 'string') {
    return HTTP.test(json) ? { url: json, type: VIDEO_HINT.test(key) || VIDEO_HINT.test(json) ? 'video' : 'image' } : null;
  }
  if (!json || typeof json !== 'object') {
    return null;
  }

  const record = json as Record<string, unknown>;
  const ownType = record.type === 'video' ? 'video' : null;
  for (const [k, value] of Object.entries(record)) {
    const found = firstMedia(value, Array.isArray(json) ? key : k);
    if (found) {
      return ownType ? { ...found, type: ownType } : found;
    }
  }
  return null;
}

export function engagement(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object') {
    return 0;
  }
  return Object.values(metrics).reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
}
