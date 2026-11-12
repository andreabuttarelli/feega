import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { prepare, textBoxesAt } from '@feega/motion-core/motion/gpu-full/display-list';
import { addClip } from '@feega/motion-core/motion/timeline';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxFace } from '$lib/motion/gpu-full/text/test-face';
import { framePicker } from './frame-pick';

const fonts: FaceBook = () => ({ face: boxFace, skew: 0 });
const typeset = { fonts, smoothing: Smoothing.Plain };
const loaded = async () => typeset;
const settled = () => new Promise((r) => setTimeout(r, 0));

const STAGE = { width: 1000, height: 700 };
const STORED_WIDTH = 0.26;

function textDoc(sizing: TextSizing) {
  const result = addClip({ ...newMotionDoc(MotionFormat.Landscape), ...STAGE }, { component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Ciao', size: 0.09, sizing, x: 0.25, y: 0.15, width: STORED_WIDTH, height: 0.07 } }, 't');
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

describe('clicking a text that hugs its words', () => {
  it('outlines the words the canvas draws, not the width stored before they were measured', async () => {
    const doc = textDoc(TextSizing.AutoWidth);
    const drawn = textBoxesAt(prepare(doc, FEEGA_TOKENS, {}, typeset), 0).t;
    const picker = framePicker({ doc, tokens: FEEGA_TOKENS, assets: {} }, () => 0, loaded);
    picker.frameRect('t');
    await settled();
    const rect = picker.frameRect('t')!;

    expect(drawn.width).toBeLessThan(STORED_WIDTH * STAGE.width);
    expect(rect.width).toBeCloseTo(drawn.width, 1);
    expect(rect.left).toBeCloseTo(drawn.left, 1);
  });

  it('a fixed-width text keeps its stored box', () => {
    const rect = framePicker({ doc: textDoc(TextSizing.Fixed), tokens: FEEGA_TOKENS, assets: {} }).frameRect('t')!;

    expect(rect.width).toBeCloseTo(STORED_WIDTH * STAGE.width, 1);
  });

  it('a click in the empty part of a fixed right-aligned box picks the text, not the layer behind', () => {
    const back = addClip({ ...newMotionDoc(MotionFormat.Landscape), ...STAGE }, { component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.25, y: 0.15, width: 0.5, height: 0.2 } }, 'back');
    const both = back.ok ? addClip(back.doc, { component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Ciao', size: 0.09, sizing: TextSizing.Fixed, align: 'right', x: 0.25, y: 0.15, width: STORED_WIDTH, height: 0.07 } }, 't') : back;
    if (!both.ok) {
      throw new Error(both.error);
    }
    const picker = framePicker({ doc: both.doc, tokens: FEEGA_TOKENS, assets: {} });
    const rect = picker.frameRect('t')!;
    const space = { toFrame: (w: { x: number; y: number }) => [w.x, w.y] } as Parameters<typeof picker.pick>[1];

    expect(picker.pick({ x: rect.left + 2, y: rect.top + rect.height / 2 }, space)).toBe('t');
  });
});
