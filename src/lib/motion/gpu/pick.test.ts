// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { TransitionKind } from '../design';
import { addClip, setTransform, setTransition, Side, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { compileScene } from './scene';
import { pickAt, rectOf } from './pick';
import { drawClip } from '../draw-create';
import { DrawTool } from '../draw-tool';
import { TextSizing } from '../text-sizing';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = (doc: MotionDoc, id: string, x: number, y: number, size: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x, y, width: size, height: size } }, id));
const sceneOf = (doc: MotionDoc) => compileScene(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' }));
const empty = newMotionDoc(MotionFormat.Landscape);
const centre = (doc: MotionDoc, id: string) => {
  const r = rectOf(sceneOf(doc), id, 0)!;
  return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
};

describe('pickAt', () => {
  it('returns null over empty canvas', () => {
    expect(pickAt(sceneOf(shape(empty, 'a', 0.2, 0.2, 0.1)), [1800, 1000], 0)).toBeNull();
  });

  it('picks the shape under the point', () => {
    const doc = shape(empty, 'a', 0.2, 0.5, 0.1);

    expect(pickAt(sceneOf(doc), centre(doc, 'a'), 0)).toBe('a');
  });

  it('picks the topmost of two overlapping shapes', () => {
    const doc = shape(shape(empty, 'under', 0.2, 0.5, 0.2), 'over', 0.2, 0.5, 0.2);

    expect(pickAt(sceneOf(doc), centre(doc, 'over'), 0)).toBe('over');
  });

  it('picks the small shape nested inside a bigger one, not its container', () => {
    const big = shape(empty, 'big', 0.5, 0.5, 0.5);
    const doc = shape(big, 'small', 0.5, 0.5, 0.05);

    expect(pickAt(sceneOf(doc), centre(doc, 'small'), 0)).toBe('small');
  });

  it('picks the container where the nested shape is not', () => {
    const big = shape(empty, 'big', 0.5, 0.5, 0.5);
    const doc = shape(big, 'small', 0.5, 0.5, 0.05);
    const [x, y] = centre(doc, 'big');

    expect(pickAt(sceneOf(doc), [x + 200, y], 0)).toBe('big');
  });

  it('follows a rotation: the centre hits, the unrotated corner misses', () => {
    const doc = must(setTransform(shape(empty, 'r', 0.5, 0.5, 0.2), 'r', { rotateZ: 45 }));
    const r = rectOf(sceneOf(doc), 'r', 0)!;
    const [cx] = centre(doc, 'r');

    expect(pickAt(sceneOf(doc), [cx, r.top + r.height / 2], 0)).toBe('r');
    expect(pickAt(sceneOf(doc), [r.left + 2, r.top + 2], 0)).toBeNull();
  });

  it('does not pick the hidden part of a clipped reveal', () => {
    const doc = must(setTransition(shape(empty, 'w', 0.5, 0.5, 0.2), 'w', Side.In, { kind: TransitionKind.Wipe, durationInFrames: 30 }));

    expect(pickAt(sceneOf(doc), centre(doc, 'w'), 0)).toBeNull();
    expect(pickAt(sceneOf(doc), centre(doc, 'w'), 1)).toBe('w');
  });

  it('ignores a clip outside its time window', () => {
    const doc = must(addClip(empty, { component: 'Shape', from: 30, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'late'));

    expect(pickAt(sceneOf(doc), [960, 540], 0)).toBeNull();
  });
});

describe('rectOf', () => {
  it('is null for an unknown clip', () => {
    expect(rectOf(sceneOf(shape(empty, 'a', 0.2, 0.2, 0.1)), 'zzz', 0)).toBeNull();
  });

  it('bounds a rotated shape wider than its box', () => {
    const flat = rectOf(sceneOf(shape(empty, 'a', 0.5, 0.5, 0.2)), 'a', 0)!;
    const turned = rectOf(sceneOf(must(setTransform(shape(empty, 'a', 0.5, 0.5, 0.2), 'a', { rotateZ: 45 }))), 'a', 0)!;

    expect(turned.width).toBeGreaterThan(flat.width);
  });
});

describe('a text the text tool just made', () => {
  const REST_S = 1;
  const made = (sizing: TextSizing) => must(drawClip(empty, DrawTool.Text, { x: 0.3, y: 0.46, width: 0.4, height: 0.12 }, 0, 'text1', sizing));

  it.each([TextSizing.AutoWidth, TextSizing.AutoHeight, TextSizing.Fixed])('is picked under its glyphs (%s)', (sizing) => {
    const doc = made(sizing);

    expect(pickAt(sceneOf(doc), centre(doc, 'text1'), REST_S)).toBe('text1');
  });
});
