import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { displayListAt, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { hitClip, linkAt } from '@feega/motion-core/motion/gpu-full/hit';
import { apply2d } from '@feega/motion-core/motion/affine';
import { caretRect } from '@feega/motion-core/motion/gpu-full/text/caret';
import { textCaretAt } from '@feega/motion-core/motion/gpu-full/display-list';
import { styleTextRange } from '../text-run-ops';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook } from './text/test-face';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const blank = newMotionDoc(MotionFormat.Landscape);
const rect = (x: number, y: number, size: number, extra: Record<string, unknown> = {}) => ({ shape: 'rect', x, y, width: size, height: size, fill: '#ff0000', ...extra });
const shape = (doc: MotionDoc, id: string, props: Record<string, unknown>) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props }, id));
const stage = (doc: MotionDoc, track = 0) => displayListAt(doc, track, FEEGA_TOKENS);

const WIDE = 1920;
const TALL = 1080;

describe('hit-testing the display list', () => {
  const stacked = shape(shape(blank, 'under', rect(0.5, 0.5, 0.4)), 'over', rect(0.5, 0.5, 0.1));

  it('answers the topmost clip under the point, in frame pixels', () => {
    expect(hitClip(stage(stacked), [WIDE / 2, TALL / 2])).toBe('over');
  });

  it('falls through to the clip below where the top one ends', () => {
    expect(hitClip(stage(stacked), [WIDE / 2 + 300, TALL / 2])).toBe('under');
  });

  it('answers nothing over empty canvas', () => {
    expect(hitClip(stage(stacked), [10, 10])).toBeNull();
  });

  it('follows the clip transform, not its resting place', () => {
    const moved = shape(blank, 'card', rect(0.5, 0.5, 0.1));
    const shifted = { ...moved, tracks: moved.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, transform: { x: 0.25 } })) })) };

    expect(hitClip(stage(shifted), [WIDE / 2, TALL / 2])).toBeNull();
    expect(hitClip(stage(shifted), [WIDE / 2 + WIDE * 0.25, TALL / 2])).toBe('card');
  });

  it('follows rotation, so a corner of the unrotated box no longer hits', () => {
    const turned = shape(blank, 'bar', { shape: 'rect', x: 0.5, y: 0.5, width: 0.4, height: 0.02, fill: '#ffffff' });
    const rotated = { ...turned, tracks: turned.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, transform: { rotateZ: 90 } })) })) };

    expect(hitClip(stage(turned), [WIDE / 2, TALL / 2 + 150])).toBeNull();
    expect(hitClip(stage(rotated), [WIDE / 2, TALL / 2 + 150])).toBe('bar');
  });

  it('skips a fully transparent clip', () => {
    const ghost = shape(blank, 'ghost', rect(0.5, 0.5, 0.2));
    const faded = { ...ghost, tracks: ghost.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, transform: { opacity: 0 } })) })) };

    expect(hitClip(stage(faded), [WIDE / 2, TALL / 2])).toBeNull();
  });
});

describe('links in text, found on the display list', () => {
  const type = { fonts: boxBook(), smoothing: Smoothing.Plain };
  const FRAME = 60;
  const LINK = 'https://feega.app/pricing';
  const plain = must(addClip(blank, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Hello world', align: 'left', x: 0.1, width: 0.5 } }, 'title'));
  const titled = must(styleTextRange(plain, 'title', { start: 0, end: 5 }, { link: LINK }));
  const prepared = prepare(titled, FEEGA_TOKENS, {}, type);
  const list = displayListAt(titled, FRAME, FEEGA_TOKENS, type);
  const caret = textCaretAt(prepared, FRAME, 'title')!;
  const over = (offset: number): [number, number] => {
    const place = caretRect(caret.lines, offset);
    return apply2d(caret.matrix, [place.x + 1, place.top + place.height / 2]) as [number, number];
  };

  it('answers the link of the run under the point', () => {
    expect(linkAt(prepared, FRAME, list, over(2))).toBe(LINK);
  });

  it('answers nothing over the unlinked part of the same line', () => {
    expect(linkAt(prepared, FRAME, list, over(8))).toBeNull();
  });

  it('answers nothing off the text', () => {
    expect(linkAt(prepared, FRAME, list, [WIDE - 5, TALL - 5])).toBeNull();
  });
});
