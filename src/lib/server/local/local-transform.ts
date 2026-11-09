import sharp from 'sharp';
import type { ImageTransform } from '$lib/server/media-thumbnails';

type Blob = { bytes: Uint8Array; contentType: string };

const RESIZABLE = /^image\/(png|jpeg|webp|avif|gif)$/;
const FIT: Record<ImageTransform['resize'], keyof sharp.FitEnum> = { contain: 'inside', cover: 'cover' };

export async function transformed(blob: Blob, query: URLSearchParams): Promise<Blob> {
  const width = Number(query.get('width'));
  const height = Number(query.get('height'));
  if (!width || !height || !RESIZABLE.test(blob.contentType)) {
    return blob;
  }

  const fit = FIT[(query.get('resize') ?? 'contain') as ImageTransform['resize']] ?? 'inside';
  const bytes = await sharp(blob.bytes).resize({ width, height, fit, withoutEnlargement: true }).webp({ quality: Number(query.get('quality')) || undefined }).toBuffer();
  return { bytes: new Uint8Array(bytes), contentType: 'image/webp' };
}
