import sharp from 'sharp';
import type { SafeFetchBytesResult } from '$lib/server/tool-guard';
import type { ScreenOutcome } from '$lib/server/moderation/screen';

export enum ViewDetail {
  Low = 'low',
  High = 'high'
}

export const VIEW_MAX_EDGE = 1568;
export const MAX_VIEWED = 6;
const EDGES: Record<ViewDetail, number> = { [ViewDetail.Low]: 768, [ViewDetail.High]: VIEW_MAX_EDGE };
const JPEG_QUALITY = 80;
const JPEG = 'image/jpeg';

export type ViewPorts = {
  fetchImage: (url: string) => Promise<SafeFetchBytesResult>;
  store: (path: string, bytes: Buffer) => Promise<void>;
  screen: (path: string) => Promise<ScreenOutcome>;
  remove: (path: string) => Promise<void>;
};

export type ViewedImage = { url: string; path: string; width: number; height: number } | { url: string; error: string };
export type ImagePart = { mediaType: string; data: string };
export type ViewOutcome = { images: ViewedImage[]; parts: ImagePart[] };

class Refused extends Error {}

const errorOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function viewOne(url: string, path: string, edge: number, ports: ViewPorts): Promise<{ image: ViewedImage; part?: ImagePart }> {
  try {
    const fetched = await ports.fetchImage(url);
    if (!fetched.ok) {
      throw new Refused(`the server answered ${fetched.status}`);
    }
    if (!fetched.mime.startsWith('image/')) {
      throw new Refused(`not a picture (${fetched.mime || 'unknown type'})`);
    }
    const { data, info } = await sharp(fetched.bytes).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
    await ports.store(path, data);
    const review = await ports.screen(path);
    if (!review.ok) {
      await ports.remove(path).catch(() => undefined);
      throw new Refused(review.error);
    }
    return { image: { url, path, width: info.width, height: info.height }, part: { mediaType: JPEG, data: data.toString('base64') } };
  } catch (e) {
    return { image: { url, error: errorOf(e) } };
  }
}

export async function viewImages(urls: string[], detail: ViewDetail, prefix: string, ports: ViewPorts): Promise<ViewOutcome> {
  const viewed = await Promise.all(urls.slice(0, MAX_VIEWED).map((url, i) => viewOne(url, `${prefix}/${i}.jpg`, EDGES[detail], ports)));
  return { images: viewed.map((v) => v.image), parts: viewed.flatMap((v) => (v.part ? [v.part] : [])) };
}
