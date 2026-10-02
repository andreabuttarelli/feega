import { AssetSize, TIER_PX } from '$lib/canvas/asset-url';

export type ThumbnailPreset = 'pickerTile' | 'mediaGrid' | 'nodeThumbnail' | 'panelTile' | 'canvas256' | 'canvas512' | 'canvas1024' | 'canvas2048';

type Resize = 'cover' | 'contain';

const DEVICE_PIXEL_RATIO = 2;
const THUMBNAIL_QUALITY = 70;
const CANVAS_TIER_QUALITY = 75;

const canvasTier = (tier: AssetSize.Px256 | AssetSize.Px512 | AssetSize.Px1024 | AssetSize.Px2048) => ({
  tilePx: TIER_PX[tier] / DEVICE_PIXEL_RATIO,
  resize: 'contain' as const,
  quality: CANVAS_TIER_QUALITY
});

const PRESETS: Record<ThumbnailPreset, { tilePx: number; resize: Resize; quality: number }> = {
  pickerTile: { tilePx: 96, resize: 'cover', quality: THUMBNAIL_QUALITY },
  mediaGrid: { tilePx: 180, resize: 'cover', quality: THUMBNAIL_QUALITY },
  nodeThumbnail: { tilePx: 140, resize: 'cover', quality: THUMBNAIL_QUALITY },
  panelTile: { tilePx: 96, resize: 'cover', quality: THUMBNAIL_QUALITY },
  canvas256: canvasTier(AssetSize.Px256),
  canvas512: canvasTier(AssetSize.Px512),
  canvas1024: canvasTier(AssetSize.Px1024),
  canvas2048: canvasTier(AssetSize.Px2048)
};

export type ImageTransform = { width: number; height: number; resize: Resize; quality: number };

export function thumbnailTransform(preset: ThumbnailPreset): ImageTransform {
  const { tilePx, resize, quality } = PRESETS[preset];
  const size = tilePx * DEVICE_PIXEL_RATIO;
  return { width: size, height: size, resize, quality };
}

type SignedUrlBucket = {
  createSignedUrl: (path: string, ttl: number, options?: { transform: ImageTransform }) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
  createSignedUrls: (paths: string[], ttl: number) => Promise<{ data: { path: string | null; signedUrl: string | null }[] | null; error: unknown }>;
};

export type SigningBucket = { name: string; open: () => SignedUrlBucket };

type Minted = { url: string; renewAt: number };

const MS_PER_S = 1000;
export const REUSABLE_SHARE_OF_TTL = 0.5;
const MINTED_CAPACITY = 5000;
const minted = new Map<string, Minted>();

function mintedKey(bucket: string, path: string, ttlSeconds: number, preset: ThumbnailPreset | undefined): string {
  return [bucket, ttlSeconds, preset ?? 'full', path].join('|');
}

function reusable(key: string, now: number): string | null {
  const entry = minted.get(key);
  if (!entry || entry.renewAt <= now) {
    return null;
  }
  return entry.url;
}

function remember(key: string, url: string, ttlSeconds: number, now: number) {
  minted.delete(key);
  minted.set(key, { url, renewAt: now + ttlSeconds * MS_PER_S * REUSABLE_SHARE_OF_TTL });
  if (minted.size <= MINTED_CAPACITY) {
    return;
  }
  const oldest = minted.keys().next().value;
  if (oldest !== undefined) {
    minted.delete(oldest);
  }
}

export function forgetSignedUrls(bucket: string, path: string): void {
  for (const key of minted.keys()) {
    if (key.startsWith(`${bucket}|`) && key.endsWith(`|${path}`)) {
      minted.delete(key);
    }
  }
}

async function mint(
  storage: SignedUrlBucket,
  paths: string[],
  ttlSeconds: number,
  preset: ThumbnailPreset | undefined
): Promise<[string, string][]> {
  if (!preset) {
    const { data } = await storage.createSignedUrls(paths, ttlSeconds);
    return (data ?? []).flatMap((row) => (row.signedUrl && row.path ? [[row.path, row.signedUrl] as [string, string]] : []));
  }

  const transform = thumbnailTransform(preset);
  const results = await Promise.all(
    paths.map(async (path) => {
      const { data } = await storage.createSignedUrl(path, ttlSeconds, { transform });
      return [path, data?.signedUrl ?? null] as const;
    })
  );
  return results.flatMap(([path, url]) => (url ? [[path, url] as [string, string]] : []));
}

export async function signThumbnailUrls(
  bucket: SigningBucket,
  paths: string[],
  ttlSeconds: number,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  const now = Date.now();
  const signed = new Map<string, string>();
  const missing: string[] = [];

  for (const path of new Set(paths.filter(Boolean))) {
    const url = reusable(mintedKey(bucket.name, path, ttlSeconds, preset), now);
    if (url) {
      signed.set(path, url);
      continue;
    }
    missing.push(path);
  }

  if (!missing.length) {
    return signed;
  }

  for (const [path, url] of await mint(bucket.open(), missing, ttlSeconds, preset)) {
    remember(mintedKey(bucket.name, path, ttlSeconds, preset), url, ttlSeconds, now);
    signed.set(path, url);
  }
  return signed;
}
