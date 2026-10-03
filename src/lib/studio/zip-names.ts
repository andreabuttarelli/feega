export type ZipSource = { assetId: string | null; productTitle: string; environment: string; shot: string; variation: number; mime: string | null };

export type ZipFile = { assetId: string; name: string; folder: string };

const EXTENSION_OF: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};
const DEFAULT_EXTENSION = 'png';

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}

export function approvedFiles(items: ZipSource[]): ZipFile[] {
  const used = new Set<string>();
  return items.flatMap((item) => {
    if (!item.assetId) {
      return [];
    }
    const folder = slug(item.productTitle);
    const base = `${folder}/${slug(item.environment)}-${slug(item.shot)}-v${item.variation}`;
    let name = `${base}.${EXTENSION_OF[item.mime ?? ''] ?? DEFAULT_EXTENSION}`;
    for (let n = 2; used.has(name); n++) {
      name = `${base}-${n}.${EXTENSION_OF[item.mime ?? ''] ?? DEFAULT_EXTENSION}`;
    }
    used.add(name);
    return [{ assetId: item.assetId, name, folder }];
  });
}
