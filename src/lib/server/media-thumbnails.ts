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

/**
 * FIRMA UN LOTTO DI PATH, CON O SENZA MINIATURA.
 *
 * `createSignedUrls` (il batch) non applica `transform`: l'endpoint lo ignora in silenzio — una
 * miniatura richiesta a lotti torna piena, e il risparmio di banda che questo file esiste per dare
 * sparisce senza un errore che lo segnali. `createSignedUrl` (singolare) lo applica, quindi con un
 * preset si firma un path alla volta, in parallelo — nessun lotto quando la miniatura conta.
 *
 * `bucket` È UNA FABBRICA, NON L'OGGETTO GIÀ COSTRUITO: `db.storage.from(...)` deve restare non
 * chiamato quando `paths` è vuoto — un client di test senza `.storage` (`generate.test.ts`) non lo
 * implementa, e valutarlo comunque lo fa esplodere per un giro che non aveva niente da firmare.
 */
export async function signThumbnailUrls(
  bucket: () => SignedUrlBucket,
  paths: string[],
  ttlSeconds: number,
  preset?: ThumbnailPreset
): Promise<Map<string, string>> {
  const clean = [...new Set(paths.filter(Boolean))];
  if (!clean.length) {
    return new Map();
  }

  const storage = bucket();

  if (!preset) {
    const { data } = await storage.createSignedUrls(clean, ttlSeconds);
    const signed = new Map<string, string>();
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signed.set(row.path, row.signedUrl);
      }
    }
    return signed;
  }

  const transform = thumbnailTransform(preset);
  const results = await Promise.all(
    clean.map(async (path) => {
      const { data } = await storage.createSignedUrl(path, ttlSeconds, { transform });
      return [path, data?.signedUrl ?? null] as const;
    })
  );

  const signed = new Map<string, string>();
  for (const [path, signedUrl] of results) {
    if (signedUrl) {
      signed.set(path, signedUrl);
    }
  }
  return signed;
}
