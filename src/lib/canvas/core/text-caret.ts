import type { BrandTokens } from '$lib/motion/brand';
import type { MotionDoc } from '$lib/motion/doc';
import { prepare, textCaretAt, type TextCaret } from '$lib/motion/gpu-full/display-list';
import { loadFonts } from '$lib/motion/gpu-full/text/load';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { stillFrame } from './frame-source';

export type CaretSource = (doc: MotionDoc, clipId: string) => Promise<TextCaret | null>;

export function caretSource(tokens: () => BrandTokens, assets: () => Record<string, string>): CaretSource {
  return async (doc, clipId) => {
    const fonts = await loadFonts(doc, assets(), tokens());
    return textCaretAt(prepare(doc, tokens(), assets(), { fonts, smoothing: Smoothing.Plain }), stillFrame(doc), clipId);
  };
}
