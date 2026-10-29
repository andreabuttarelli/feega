import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { prepare, textBoxesAt } from '@feega/motion-core/motion/gpu-full/display-list';
import { faceBook, type FaceRule, type Source } from '@feega/motion-core/motion/gpu-full/text/fonts';
import { fontkitSource } from '@feega/motion-core/motion/gpu-full/text/fontkit-face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { wrapInStack } from './ops';

const LATIN: [number, number][] = [[0, 0xff]];
const rules: FaceRule[] = [
  { family: 'DM Sans', italic: false, weight: [100, 1000], url: 'static/fonts/dm-sans-latin.woff2', ranges: LATIN },
  { family: 'Inter', italic: false, weight: [100, 900], url: 'static/fonts/inter-latin.woff2', ranges: LATIN }
];
const sources = new Map<string, Source>(rules.map((r) => [r.url, fontkitSource(new Uint8Array(readFileSync(r.url)))]));
const typeset = { fonts: faceBook(rules, sources, []), smoothing: Smoothing.Plain };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const SAMPLES = ['Get started', 'New in Feega', 'Launch week', 'WWW mmm'];

describe('hugged text in a stack', () => {
  it.each(SAMPLES)('the box is as wide as the shaped "%s"', (text) => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 120, props: { text, size: 0.05, sizing: 'auto', x: 0.3, y: 0.5, width: 0.3, height: 0.1 } }, 't'));
    const prepared = prepare(must(wrapInStack(doc, ['t'], 's', 'track-s')), FEEGA_TOKENS, {}, typeset);
    const shaped = textBoxesAt(prepared, 0).t;
    const laid = prepared.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 't')!;

    expect(Number(laid.props.width) * prepared.doc.width).toBeCloseTo(shaped.width, 0);
  });
});
