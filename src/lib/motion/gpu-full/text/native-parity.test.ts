import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../../doc';
import { addClip, type OpResult } from '../../timeline';
import { FillType } from '../../fill/model';
import { FontCategory, FontSource, type FontFace } from '../../fonts/model';
import { addAnimator } from '../../text-animators/ops';
import { AnimatorUnit, SelectorShape } from '../../text-animators/model';
import { displayListAt, ItemKind, type DisplayList } from '../display-list';
import { faceBook, type FaceRule, type Source } from './fonts';
import { fontkitSource } from './fontkit-face';
import { Smoothing, type Typeset } from './painter';

const FIXTURE = '../../../../../packages/gpu-core/tests/fixtures/text-parity.json';
const LATIN: [number, number][] = [[0, 0xff]];
const DIGITS = 1e4;

const rules: FaceRule[] = [
  { family: 'DM Sans', italic: false, weight: [100, 1000], url: 'static/fonts/dm-sans-latin.woff2', ranges: LATIN },
  { family: 'Inter', italic: false, weight: [100, 900], url: 'static/fonts/inter-latin.woff2', ranges: LATIN },
  { family: 'Fraunces', italic: false, weight: [100, 900], url: 'static/fonts/fraunces-latin.woff2', ranges: LATIN },
  { family: 'Fragment Mono', italic: false, weight: [400, 400], url: 'static/fonts/fragment-mono-latin.woff2', ranges: LATIN }
];

const sources = new Map<string, Source>(rules.map((r) => [r.url, fontkitSource(new Uint8Array(readFileSync(r.url)))]));

const registry: FontFace[] = [
  { family: 'Inter', source: FontSource.Google, category: FontCategory.Sans, weights: [300, 400], italic: false, axes: [] },
  { family: 'Fraunces', source: FontSource.Google, category: FontCategory.Serif, weights: [700], italic: false, axes: [] }
];

const typeset = (smoothing: Smoothing): Typeset => ({ fonts: faceBook(rules, sources, registry), smoothing });

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const blank: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), fonts: registry };

const clip = (component: string, props: Record<string, unknown>, from = 0) => must(addClip(blank, { component: component as never, from, durationInFrames: 120, props }, 'c'));

const animated = (doc: MotionDoc, unit: AnimatorUnit, values: Record<string, unknown>) => must(addAnimator(doc, 'c', 'a', { unit, shape: SelectorShape.Square, end: 60, values } as never));

const red = { type: FillType.Solid, color: '#ff3300' };
const stops = [
  { color: '#ffcc00', pos: 0 },
  { color: '#3366ff', pos: 1 }
];

type Case = { name: string; doc: MotionDoc; frame: number; smoothing?: Smoothing };

const CASES: Case[] = [
  { name: 'title revealing', doc: clip('Title', { text: 'Make it move\nfast' }), frame: 8 },
  { name: 'title settled', doc: clip('Title', { text: 'Make it move\nfast' }), frame: 60 },
  { name: 'text wrapping, fading up', doc: clip('Text', { text: 'Body copy that wraps across a few lines', width: 0.3, align: 'left' }), frame: 6 },
  { name: 'text auto width', doc: clip('Text', { text: 'One line only', sizing: 'auto', align: 'right' }), frame: 40 },
  { name: 'kicker tracked', doc: clip('Kicker', { text: 'new release', tracking: 0.1 }), frame: 30 },
  { name: 'caption on its box', doc: clip('Caption', { text: 'Captions sit on a box', background: '#000000' }), frame: 30 },
  { name: 'font inter light', doc: clip('Text', { text: 'Inter, weight 300', font: 'Inter', weight: 300 }), frame: 40 },
  { name: 'font fraunces bold synthetic italic', doc: clip('Title', { text: 'Serif title', font: 'Fraunces', weight: 700, italic: true }), frame: 60 },
  { name: 'font mono', doc: clip('Text', { text: 'mono() => 42', font: 'mono' }), frame: 40 },
  { name: 'animator chars', doc: animated(clip('Text', { text: 'Per character', align: 'left' }), AnimatorUnit.Char, { opacity: 0.2, y: 0.5, rotation: 20 }), frame: 40 },
  { name: 'animator words tint blur', doc: animated(clip('Text', { text: 'Words get a tint', fills: [red] }), AnimatorUnit.Word, { color: '#00ff88', blur: 3, scale: 1.4 }), frame: 40 },
  { name: 'gradient fill and outside stroke', doc: clip('Text', { text: 'Outlined', fills: [{ type: FillType.Linear, angle: 30, stops }], strokes: [{ paint: red, width: 0.004, align: 'outside' }] }), frame: 40 },
  { name: 'radial fill title', doc: clip('Title', { text: 'Radial', fills: [{ type: FillType.Radial, center: { x: 0.3, y: 0.5 }, radius: 1, stops }] }), frame: 60 },
  { name: 'turned and scaled', doc: clip('Text', { text: 'Turned', rotation: 15, scale: 1.3, opacity: 0.8 }), frame: 40 },
  { name: 'dilated smoothing', doc: clip('Text', { text: 'Smooth edges' }), frame: 40, smoothing: Smoothing.Dilated }
];

const round = (_key: string, v: unknown) => (typeof v === 'number' ? Math.round(v * DIGITS) / DIGITS : v);

const bare = ({ unsupported: _gaps, ...list }: DisplayList) => list;

function fixture() {
  return CASES.map(({ name, doc, frame, smoothing = Smoothing.Plain }) => {
    const paths = displayListAt(doc, frame, FEEGA_TOKENS, typeset(smoothing));
    const native = displayListAt(doc, frame, FEEGA_TOKENS, { ...typeset(smoothing), native: { rules, registry } });
    return { name, list: bare(native), expected: paths.items, gaps: [...paths.unsupported, ...native.unsupported] };
  });
}

describe('text handed to the native core', () => {
  const cases = fixture();

  it('paints every parity case through the TS pipeline', () => {
    for (const c of cases) {
      expect(c.gaps, c.name).toEqual([]);
      expect(c.expected.length, c.name).toBeGreaterThan(0);
    }
  });

  it('becomes one text item per clip with the faces on the list', () => {
    for (const c of cases) {
      expect(c.list.items.map((i) => i.kind)).toEqual([ItemKind.Text]);
      expect(c.list.faces).toEqual(rules);
    }
  });

  it('matches the fixture the native parity test reads', async () => {
    await expect(JSON.stringify(cases.map(({ gaps: _gaps, ...c }) => c), round)).toMatchFileSnapshot(FIXTURE);
  });
});
