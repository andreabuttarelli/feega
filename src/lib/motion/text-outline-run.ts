import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { textToPath, type Lettering } from './text-outline';

export type LetteringLoader = (doc: MotionDoc) => Promise<Lettering>;

export const letteringOf =
  (tokens: BrandTokens, assets: Record<string, string>): LetteringLoader =>
  async (doc) => ({ fonts: await loadFonts(doc, assets, tokens), tokens, assets });

export async function outlineTexts(doc: MotionDoc, ids: readonly string[], load: LetteringLoader): Promise<OpResult> {
  const lettering = await load(doc);
  return ids.reduce<OpResult>((result, id) => (result.ok ? textToPath(result.doc, id, lettering) : result), { ok: true, doc });
}
