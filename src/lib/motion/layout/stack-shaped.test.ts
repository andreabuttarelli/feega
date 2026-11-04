import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';
import { faceBook, type FaceRule, type Source } from '@feega/motion-core/motion/gpu-full/text/fonts';
import { fontkitSource } from '@feega/motion-core/motion/gpu-full/text/fontkit-face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { setAutoLayout, sizeStackAround, wrapInStack } from './ops';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { stackLineAt } from './stack-drag';
import { StripKind, layoutStrips } from './guides';

const LATIN: [number, number][] = [[0, 0xff]];
const rules: FaceRule[] = [
  { family: 'DM Sans', italic: false, weight: [100, 1000], url: 'static/fonts/dm-sans-latin.woff2', ranges: LATIN },
  { family: 'Inter', italic: false, weight: [100, 900], url: 'static/fonts/inter-latin.woff2', ranges: LATIN }
];
const sources = new Map<string, Source>(rules.map((r) => [r.url, fontkitSource(new Uint8Array(readFileSync(r.url)))]));
const typeset = { fonts: faceBook(rules, sources, []), smoothing: Smoothing.Plain };
const measure = shapedText(typeset);

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const text = (doc: MotionDoc, id: string, words: string, y: number) =>
  must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 120, props: { text: words, size: 0.05, sizing: 'auto', x: 0.3, y, width: 0.3, height: 0.1 } }, id));

const wrapped = must(wrapInStack(text(text(newMotionDoc(MotionFormat.Landscape), 'a', 'Launch week', 0.3), 'b', 'Get started now', 0.5), ['a', 'b'], 's', 'track-s'));

const drawn = (doc: MotionDoc, id: string) => {
  const clip = prepare(doc, FEEGA_TOKENS, {}, typeset).doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === id)!;
  const width = Number(clip.props.width) * doc.width;
  const height = Number(clip.props.height) * doc.height;
  return { left: Number(clip.props.x) * doc.width - width / 2, top: Number(clip.props.y) * doc.height - height / 2, width, height };
};

describe('a wrapped stack of text resizes from the box the canvas draws', () => {
  it('stretching the right side keeps the drawn left edge and scales the drawn width', () => {
    const box = drawn(wrapped, 's');
    const resized = must(sizeStackAround(wrapped, 's', [box.left, box.top], 1.5, 1, measure));
    const after = drawn(resized, 's');

    expect(after.left).toBeCloseTo(box.left, 0);
    expect(after.width).toBeCloseTo(box.width * 1.5, 0);
  });
});

describe('the drop line in a wrapped stack sits on the drawn children', () => {
  it('between the two texts, the line spans the drawn stack width', () => {
    const stack = drawn(wrapped, 's');
    const a = drawn(wrapped, 'a');
    const line = stackLineAt(wrapped, [stack.left + 10, a.top + a.height - 2], measure)!;

    expect(line.x1).toBeCloseTo(stack.left, 0);
    expect(line.x2).toBeCloseTo(stack.left + stack.width, 0);
  });
});

describe('the padding handles of a wrapped stack sit on the drawn edges', () => {
  it('the right padding strip ends at the drawn right edge', () => {
    const stack = drawn(wrapped, 's');
    const right = layoutStrips(wrapped, 's', measure).find((s) => s.kind === StripKind.Padding && s.side === 'right')!;

    expect(right.box.left + right.box.width).toBeCloseTo(stack.left + stack.width, 0);
  });
});

describe('shrinking a wrapped column of text wraps the text', () => {
  const box = drawn(wrapped, 's');
  const shrunk = must(sizeStackAround(wrapped, 's', [box.left, box.top], 0.5, 1, measure));
  const stack = drawn(shrunk, 's');

  it.each(['a', 'b'])('text %s stays inside the narrower stack', (id) => {
    const kid = drawn(shrunk, id);

    expect(kid.left).toBeGreaterThanOrEqual(stack.left - 0.5);
    expect(kid.left + kid.width).toBeLessThanOrEqual(stack.left + stack.width + 0.5);
  });

  it('the long line breaks, and the stack grows down to hold it', () => {
    expect(drawn(shrunk, 'b').height).toBeGreaterThan(drawn(wrapped, 'b').height * 1.5);
    expect(stack.top + stack.height).toBeGreaterThanOrEqual(drawn(shrunk, 'b').top + drawn(shrunk, 'b').height - 0.5);
  });

  it('the wrapped lines start where the stack lines its children up', () => {
    const kid = shrunk.tracks.flatMap((t) => t.clips).find((c) => c.id === 'b')!;

    expect(kid.props.align).toBe('left');
  });

  it('a row of text keeps its single lines', () => {
    const row = must(setAutoLayout(wrapped, 's', { direction: Direction.Horizontal }));
    const rowBox = drawn(row, 's');
    const narrowed = must(sizeStackAround(row, 's', [rowBox.left, rowBox.top], 0.5, 1, measure));

    expect(drawn(narrowed, 'b').height).toBeCloseTo(drawn(row, 'b').height, 0);
  });
});
