import sharp from 'sharp';
import type { ImageTransform } from '$lib/server/media-thumbnails';

type Blob = { bytes: Uint8Array; contentType: string };

const DEFAULT_QUALITY = 80;
const RESIZABLE = /^image\/(png|jpeg|webp|avif|gif)$/;
const FIT: Record<ImageTransform['resize'], 'inside' | 'cover'> = { contain: 'inside', cover: 'cover' };

export async function transformed(blob: Blob, query: URLSearchParams): Promise<Blob> {
  const width = Number(query.get('width'));
  const height = Number(query.get('height'));
  if (!width || !height || !RESIZABLE.test(blob.contentType)) {
    return blob;
  }

  const fit = FIT[(query.get('resize') ?? 'contain') as ImageTransform['resize']] ?? 'inside';
  const quality = Number(query.get('quality')) || DEFAULT_QUALITY;
  const bytes = await sharp(Buffer.from(blob.bytes)).resize({ width, height, fit, withoutEnlargement: true }).webp({ quality }).toBuffer();
  return { bytes: new Uint8Array(bytes), contentType: 'image/webp' };
}

type Resize = (blob: Blob, query: URLSearchParams) => Promise<Blob>;

const RESIZED_KEPT = 4000;

export function resizedOnce(resize: Resize, open: number) {
  const kept = new Map<string, Promise<Blob>>();
  const waiting: (() => void)[] = [];
  let running = 0;

  const turn = () => new Promise<void>((start) => {
    waiting.push(start);
    next();
  });

  function next() {
    while (running < open && waiting.length) {
      running++;
      waiting.shift()!();
    }
  }

  const run = async (blob: Blob, query: URLSearchParams) => {
    await turn();
    try {
      return await resize(blob, query);
    } finally {
      running--;
      next();
    }
  };

  const sized = (key: string, blob: Blob, query: URLSearchParams): Promise<Blob> => {
    const id = `${key}?${query}`;
    const known = kept.get(id);
    if (known) {
      return known;
    }
    const made = run(blob, query);
    made.catch(() => kept.delete(id));
    kept.set(id, made);
    if (kept.size > RESIZED_KEPT) {
      kept.delete(kept.keys().next().value!);
    }
    return made;
  };

  const forget = (key: string) => {
    for (const id of [...kept.keys()].filter((k) => k.startsWith(`${key}?`))) {
      kept.delete(id);
    }
  };

  return Object.assign(sized, { forget });
}
