import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, textCaretAt, type TextCaret } from '@feega/motion-core/motion/gpu-full/display-list';
import { loadFonts } from '$lib/motion/gpu-full/text/load';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { stillFrame } from './frame-source';

export type CaretSource = (doc: MotionDoc, clipId: string) => Promise<TextCaret | null>;

export function caretSource(tokens: () => BrandTokens, assets: () => Record<string, string>): CaretSource {
  return async (doc, clipId) => {
    const fonts = await loadFonts(doc, assets(), tokens());
    return textCaretAt(prepare(doc, tokens(), assets(), { fonts, smoothing: Smoothing.Plain }), stillFrame(doc), clipId);
  };
}
