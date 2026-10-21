import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes, type OpResult } from './timeline';
import { parsePath } from './shape/geometry';
import { textToPath } from './text-outline';
import type { Outliner } from './fonts/outliner';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const ADVANCE_EM = 0.5;
const ASCENT_EM = 0.8;
const DESCENT_EM = 0.2;

const blocks: Outliner = {
  advance: (run) => [...run].length * ADVANCE_EM,
  ascent: ASCENT_EM,
  descent: DESCENT_EM,
  trace: (char, x, y, size) =>
    char.trim() === '' ? [] : [{ type: 'M', x, y: y - size }, { type: 'L', x: x + size * ADVANCE_EM, y: y - size }, { type: 'L', x: x + size * ADVANCE_EM, y }, { type: 'L', x, y }, { type: 'Z' }]
};

const start = newMotionDoc(MotionFormat.Square);
const SIZE_FRACTION = 0.1;
const BOX_FRACTION = 0.5;

const withText = (props: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  must(addClip(start, { component: 'Text', from: 0, durationInFrames: 60, props: { x: 0.5, y: 0.5, width: BOX_FRACTION, height: BOX_FRACTION, size: SIZE_FRACTION, leading: 1, tracking: 0, align: 'left', ...props }, ...extra }, 't'));

const SIZE_PX = SIZE_FRACTION * Math.min(start.width, start.height);

const outlineOf = (doc: MotionDoc) => {
  const parsed = parsePath(String(findClip(doc, 't')!.clip.props.path));
  if (typeof parsed === 'string') {
    throw new Error(parsed);
  }
  return parsed;
};

const boxPx = start.width * BOX_FRACTION;
const originsX = (doc: MotionDoc) => outlineOf(doc).map((c) => c.vertices[0].p[0] * boxPx);
const outlined = (props: Record<string, unknown>) => must(textToPath(withText(props), 't', blocks));

describe('text to path', () => {
  it('turns a text clip into a free path shape in the same box', () => {
    const clip = findClip(outlined({ text: 'A' }), 't')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.props).toMatchObject({ shape: 'path', x: 0.5, y: 0.5, width: BOX_FRACTION, height: BOX_FRACTION });
  });

  it('puts the first glyph at the left edge of the box and its baseline where the text sits', () => {
    const doc = outlined({ text: 'A' });
    const size = SIZE_PX;
    const [topLeft, , bottomRight] = outlineOf(doc)[0].vertices.map((v) => v.p);
    const lineTop = (boxPx - size) / 2;
    const baseline = lineTop + ASCENT_EM * size + (size - (ASCENT_EM + DESCENT_EM) * size) / 2;

    expect(topLeft[0]).toBeCloseTo(0, 3);
    expect(bottomRight[1] * boxPx).toBeCloseTo(baseline, 0);
  });

  it('shifts every glyph by the tracking', () => {
    const plain = originsX(outlined({ text: 'AB' }));
    const tracked = originsX(outlined({ text: 'AB', tracking: 0.2 }));

    expect(tracked[1] - plain[1]).toBeCloseTo(0.2 * SIZE_PX, 0);
  });

  it('centres a line inside the box', () => {
    const left = originsX(outlined({ text: 'A\nABCD' }));
    const centred = originsX(outlined({ text: 'A\nABCD', align: 'center' }));

    expect(centred[0] - left[0]).toBeCloseTo((boxPx - ADVANCE_EM * SIZE_PX) / 2, 0);
  });

  it('wraps words that do not fit the box onto the next line', () => {
    const rows = new Set(outlineOf(outlined({ text: 'AAAA AAAA', width: 0.25 })).map((c) => Math.round(c.vertices[3].p[1] * 1000)));

    expect(rows.size).toBe(2);
  });

  it('keeps fills, opacity, transform and constraints', () => {
    const doc = withText({ text: 'A', color: '#ff0000', opacity: 0.4 }, { transform: { rotateZ: 12 }, constraints: { horizontal: 'right', vertical: 'top' } });
    const before = findClip(doc, 't')!.clip;
    const after = findClip(must(textToPath(doc, 't', blocks)), 't')!.clip;

    expect(after.transform).toEqual(before.transform);
    expect(after.constraints).toEqual(before.constraints);
    expect(after.props.opacity).toBe(0.4);
    expect(JSON.stringify(after.props.fills)).toContain('#ff0000');
  });

  it('drops keyframes of props a shape does not have, and keeps the rest', () => {
    const key = (value: number) => [{ frame: 0, value, ease: 'standard' }];
    const doc = must(setKeyframes(must(setKeyframes(withText({ text: 'A' }), 't', 'tracking', key(0.1))), 't', 'x', key(0.5)));
    const after = findClip(must(textToPath(doc, 't', blocks)), 't')!.clip;

    expect(Object.keys(after.keyframes)).toEqual(['x']);
  });

  it('refuses what is not text, has no letters, or does not fit a path', () => {
    const shape = must(addClip(start, { component: 'Shape', from: 0, durationInFrames: 60, props: {} }, 't'));

    expect(textToPath(shape, 't', blocks).ok).toBe(false);
    expect(textToPath(withText({ text: '   ' }), 't', blocks).ok).toBe(false);
    const detailed: Outliner = { ...blocks, trace: (char, x, y, size) => Array.from({ length: 60 }, (_, i) => ({ type: 'L' as const, x: x + i * size * 0.01, y: y - i * size * 0.01 })) };
    expect(textToPath(withText({ text: 'A'.repeat(450), width: 1, sizing: 'auto' }), 't', detailed).ok).toBe(false);
    expect(textToPath(start, 'missing', blocks).ok).toBe(false);
  });
});
