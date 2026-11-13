import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, textCaretAt } from '@feega/motion-core/motion/gpu-full/display-list';
import { addClip } from '@feega/motion-core/motion/timeline';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { apply2d } from '@feega/motion-core/motion/affine';
import { caretRect } from '@feega/motion-core/motion/gpu-full/text/caret';
import { boxFace } from '$lib/motion/gpu-full/text/test-face';
import { caretOffsetAt, openingSpan } from './text-caret';

const TEXT = 'Ciao';

function rightAligned() {
  const doc = addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 700 }, { component: 'Text', from: 0, durationInFrames: 150, props: { text: TEXT, size: 0.05, sizing: TextSizing.Fixed, align: 'right', x: 0.5, y: 0.5, width: 0.8, height: 0.1 } }, 't');
  if (!doc.ok) {
    throw new Error(doc.error);
  }
  return textCaretAt(prepare(doc.doc, FEEGA_TOKENS, {}, { fonts: () => ({ face: boxFace, skew: 0 }), smoothing: Smoothing.Plain }), 0, 't')!;
}

const atOffset = (caret: ReturnType<typeof rightAligned>, offset: number, dx = 0): [number, number] => {
  const place = caretRect(caret.lines, offset);
  return apply2d(caret.matrix, [place.x + dx, place.top + place.height / 2]) as [number, number];
};

describe('a double-click on a text puts the caret at the nearest character', () => {
  it('in the empty part of a right-aligned box, before the first character', () => {
    const caret = rightAligned();
    const [x, y] = apply2d(caret.matrix, [caret.width * 0.05, caret.height / 2]);

    expect(caretOffsetAt(caret, [x, y])).toBe(0);
  });

  it('between two characters, at the closer gap', () => {
    const caret = rightAligned();

    expect(caretOffsetAt(caret, atOffset(caret, 2, 1))).toBe(2);
  });

  it('past the last character, at the end', () => {
    const caret = rightAligned();

    expect(caretOffsetAt(caret, atOffset(caret, TEXT.length, 40))).toBe(TEXT.length);
  });
});

describe('the editor opens', () => {
  it('with the whole text selected when nothing says where', () => {
    expect(openingSpan(TEXT, null)).toEqual({ start: 0, end: TEXT.length });
  });

  it('with a collapsed caret where the double-click landed', () => {
    expect(openingSpan(TEXT, 2)).toEqual({ start: 2, end: 2 });
  });
});
