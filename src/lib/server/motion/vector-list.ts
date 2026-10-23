import type { BrandTokens } from '$lib/motion/brand';
import type { MotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare, type DisplayList } from '$lib/motion/gpu-full/display-list';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { fontLoader } from '$lib/motion/gpu-full/text/load';
import { stillSeconds } from '$lib/motion/still';
import { imageSources } from '$lib/motion/export-svg';

export type VectorInput = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

export type Fetcher = (url: string) => Promise<{ ok: boolean; headers: { get: (name: string) => string | null }; arrayBuffer: () => Promise<ArrayBuffer> }>;

export type Vector = { list: DisplayList; images: ReadonlyMap<string, string> };

const DEFAULT_MIME = 'application/octet-stream';

export async function inlineImages(sources: string[], fetcher: Fetcher): Promise<Map<string, string>> {
  const inlined = new Map<string, string>();
  await Promise.all(
    sources.map(async (src) => {
      const response = await fetcher(src).catch(() => null);
      if (!response?.ok) {
        return;
      }
      const mime = response.headers.get('content-type')?.split(';')[0] ?? DEFAULT_MIME;
      inlined.set(src, `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`);
    })
  );
  return inlined;
}

export type VectorIo = { fetcher?: Fetcher; fonts?: ReturnType<typeof fontLoader> };

export async function vectorOf({ doc, tokens, assets }: VectorInput, io: VectorIo = {}): Promise<Vector> {
  const { fetcher = fetch, fonts: loadFonts = fontLoader() } = io;
  const fonts = await loadFonts(doc, assets, tokens);
  const frame = Math.round((stillSeconds(doc) ?? 0) * doc.fps);
  const list = drawFrame(prepare(doc, tokens, assets, { fonts, smoothing: Smoothing.Plain }), frame);
  return { list, images: await inlineImages(imageSources(list), fetcher) };
}
