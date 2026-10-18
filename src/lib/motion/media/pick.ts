export enum MediaKind {
  Image = 'image',
  Video = 'video'
}

export enum MediaAccept {
  Image = 'image',
  Video = 'video',
  Any = 'any'
}

export enum PickFrom {
  Upload = 'upload',
  Link = 'link',
  Library = 'library'
}

export type MediaPick = { kind: MediaKind; assetId: string; url?: undefined } | { kind: MediaKind; url: string; assetId?: undefined };

export type LinkVerdict = { ok: true; url: string; kind: MediaKind } | { ok: false; error: string };

const VIDEO_MARK = 'video:';
const STORED_LINK = /^(https?:|data:|blob:|\/)/i;
const HTTP_LINK = /^https?:\/\/[^\s/]+\.[^\s]+$/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)([?#]|$)/i;

const ACCEPTED: Record<MediaAccept, readonly MediaKind[]> = {
  [MediaAccept.Image]: [MediaKind.Image],
  [MediaAccept.Video]: [MediaKind.Video],
  [MediaAccept.Any]: [MediaKind.Image, MediaKind.Video]
};

export const accepts = (accept: MediaAccept, kind: MediaKind) => ACCEPTED[accept].includes(kind);

export const kindOfFile = (mimeType: string): MediaKind | null => (mimeType.startsWith('video/') ? MediaKind.Video : mimeType.startsWith('image/') ? MediaKind.Image : null);

export function pickOfItem(raw: unknown): MediaPick | null {
  const item = typeof raw === 'string' ? raw.trim() : '';
  const video = item.startsWith(VIDEO_MARK);
  const ref = video ? item.slice(VIDEO_MARK.length).trim() : item;
  if (!ref) {
    return null;
  }
  const kind = video ? MediaKind.Video : MediaKind.Image;
  return STORED_LINK.test(ref) ? { kind, url: ref } : { kind, assetId: ref };
}

export function itemOfPick(pick: MediaPick | null): string {
  if (!pick) {
    return '';
  }
  const ref = pick.assetId ?? pick.url;
  return pick.kind === MediaKind.Video ? `${VIDEO_MARK}${ref}` : ref;
}

export function linkOf(raw: string): LinkVerdict {
  const url = raw.trim();
  if (!HTTP_LINK.test(url)) {
    return { ok: false, error: 'Paste a full link that starts with https://' };
  }
  return { ok: true, url, kind: VIDEO_FILE.test(url) ? MediaKind.Video : MediaKind.Image };
}

export type MediaSlot = { assetId: string; kind: string } & Record<string, unknown>;

const ACCEPT_OF_KIND: Record<string, MediaAccept> = { [MediaKind.Image]: MediaAccept.Image, [MediaKind.Video]: MediaAccept.Video };

export const acceptOf = (kind: string | undefined): MediaAccept => (kind ? (ACCEPT_OF_KIND[kind] ?? MediaAccept.Any) : MediaAccept.Any);

export const slotPick = (slot: MediaSlot): MediaPick => ({ kind: slot.kind === MediaKind.Video ? MediaKind.Video : MediaKind.Image, assetId: slot.assetId });

export function setSlot(list: readonly MediaSlot[], at: number, pick: MediaPick | null): MediaSlot[] {
  if (!pick?.assetId) {
    return list.filter((_, i) => i !== at);
  }
  const slot = { ...(list[at] ?? {}), assetId: pick.assetId, kind: pick.kind };
  return at < list.length ? list.map((s, i) => (i === at ? slot : s)) : [...list, slot];
}
