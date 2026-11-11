import type { ImageTransform } from '$lib/server/media-thumbnails';

export const transformQuery = (t: ImageTransform) => `?${new URLSearchParams({ width: String(t.width), height: String(t.height), resize: t.resize, quality: String(t.quality) })}`;
