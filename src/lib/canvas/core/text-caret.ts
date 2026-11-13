import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, textCaretAt, type TextCaret } from '@feega/motion-core/motion/gpu-full/display-list';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { stillFrame } from './frame-source';
import { apply2d, invert2d } from '@feega/motion-core/motion/parent';
import { hitTest, unitsOf } from '@feega/motion-core/motion/gpu-full/text/caret';
import type { Span } from '$lib/canvas/editable-text';

export type CaretSource = (doc: MotionDoc, clipId: string) => Promise<TextCaret | null>;

export function caretSource(tokens: () => BrandTokens, assets: () => Record<string, string>): CaretSource {
  return async (doc, clipId) => {
    const fonts = await loadFonts(doc, assets(), tokens());
    return textCaretAt(prepare(doc, tokens(), assets(), { fonts, smoothing: Smoothing.Plain }), stillFrame(doc), clipId);
  };
}

export function caretOffsetAt(caret: TextCaret, point: [number, number]): number {
  const [x, y] = apply2d(invert2d(caret.matrix), point);
  return unitsOf(caret.text, hitTest(caret.lines, x, y));
}

export const openingSpan = (text: string, at: number | null): Span => (at === null ? { start: 0, end: text.length } : { start: at, end: at });
