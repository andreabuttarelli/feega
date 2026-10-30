import sharp from 'sharp';
import { similarity } from '$lib/server/web/ui-fidelity';
import type { PageTree } from './page-tree';
import { fontsWanted, urlPlan, type UrlPlan } from './url-doc';

export const FOLD = { width: 1280, height: 800 };

const SIDE_GAP = 20;
const THUMB_WIDTH = 1600;
const WHITE = { r: 255, g: 255, b: 255 };

export type Scored = { fold: number; full: number; bands: number[]; a: Buffer; b: Buffer; height: number };

export type PlannedPage = { made: UrlPlan; assetOf: Record<string, string>; assets: Record<string, string> };

export const band = (png: Buffer, top: number) => sharp(png).extract({ left: 0, top, ...FOLD }).png().toBuffer();

async function inlined(url: string): Promise<string> {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    return url;
  }
  return `data:font/woff2;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
}

export async function plannedPage(tree: PageTree): Promise<PlannedPage> {
  let n = 0;
  const faces = fontsWanted(tree);
  const fonts = Object.fromEntries(faces.map((f, i) => [f.url, `font-${i}`]));
  const made = urlPlan(tree, () => `c${++n}`, undefined, fonts)!;
  const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
  const images = Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, url]);
  const faceUrls = await Promise.all(faces.map(async (f, i) => [`font-${i}`, await inlined(f.url)]));
  return { made, assetOf, assets: { ...Object.fromEntries(images), ...Object.fromEntries(faceUrls) } };
}

export async function stacked(parts: { png: Buffer; height: number }[]): Promise<Buffer> {
  const placed: { input: Buffer; top: number; left: number }[] = [];
  let top = 0;
  for (const part of parts) {
    placed.push({ input: await sharp(part.png).resize({ width: FOLD.width, height: part.height, fit: 'fill' }).png().toBuffer(), top, left: 0 });
    top += part.height;
  }
  return sharp({ create: { width: FOLD.width, height: top, channels: 3, background: WHITE } }).composite(placed).png().toBuffer();
}

async function padded(png: Buffer, height: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const fitted = await sharp(png).resize({ width: FOLD.width }).png().toBuffer();
  const tall = Math.round((meta.height! * FOLD.width) / meta.width!);
  const cut = Math.min(tall, height);
  const top = await sharp(fitted).extract({ left: 0, top: 0, width: FOLD.width, height: cut }).png().toBuffer();
  return sharp({ create: { width: FOLD.width, height, channels: 3, background: WHITE } }).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
}

export async function sideBySide(a: Buffer, b: Buffer, height: number): Promise<Buffer> {
  const joined = await sharp({ create: { width: FOLD.width * 2 + SIDE_GAP, height, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: FOLD.width + SIDE_GAP, top: 0 }
    ])
    .png()
    .toBuffer();
  return sharp(joined).resize({ width: THUMB_WIDTH }).png().toBuffer();
}

export async function scores(source: Buffer, drawn: Buffer): Promise<Scored> {
  const height = Math.floor((await sharp(source).metadata()).height! / FOLD.height) * FOLD.height || FOLD.height;
  const [a, b] = [await padded(source, height), await padded(drawn, height)];
  const bands: number[] = [];
  for (let top = 0; top + FOLD.height <= height; top += FOLD.height) {
    bands.push(await similarity(await band(a, top), await band(b, top)));
  }
  return { fold: bands[0], full: bands.reduce((s, v) => s + v, 0) / bands.length, bands, a, b, height };
}
