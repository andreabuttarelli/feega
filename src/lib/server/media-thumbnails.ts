export type ThumbnailPreset = 'pickerTile' | 'mediaGrid' | 'nodeThumbnail' | 'panelTile';

const DEVICE_PIXEL_RATIO = 2;
const THUMBNAIL_QUALITY = 70;

const THUMBNAIL_TILE_PX: Record<ThumbnailPreset, number> = {
  pickerTile: 96,
  mediaGrid: 180,
  nodeThumbnail: 140,
  panelTile: 96
};

export type ImageTransform = { width: number; height: number; resize: 'cover'; quality: number };

export function thumbnailTransform(preset: ThumbnailPreset): ImageTransform {
  const size = THUMBNAIL_TILE_PX[preset] * DEVICE_PIXEL_RATIO;
  return { width: size, height: size, resize: 'cover', quality: THUMBNAIL_QUALITY };
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
