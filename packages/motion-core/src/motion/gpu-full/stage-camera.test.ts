import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { FEEGA_TOKENS } from '../brand';
import { addClip } from '../timeline';
import { setCamera, setClipDepth } from '../camera-ops';
import { cameraMath, stageSpec } from '../camera';
import { sampleTrack } from '../keyframes';
import { apply2d } from '../affine';
import { displayListAt, ItemKind, type PathItem } from './display-list';

const DOLLY = 600;
const FAR = 2000;
const CARD = { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#FF0000' }] };

function ok<T>(verdict: { ok: true; doc: T } | { ok: false; error: string }): T {
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

function scene(dolly: number): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: CARD }, 'far'));
  doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: CARD }, 'near'));
  doc = ok(setClipDepth(doc, 'far', { depth: FAR }));
  return ok(setCamera(doc, { base: { z: dolly } }));
}

function widthOf(doc: MotionDoc, clip: string): number {
  const item = displayListAt(doc, 0, FEEGA_TOKENS).items.find((i) => i.clip === clip && i.kind === ItemKind.Path) as PathItem;
  const xs = item.contours.flatMap((c) => c.filter((_, i) => i % 2 === 0).map((x, i) => apply2d(item.matrix, [x, c[i * 2 + 1]])[0]));
  return Math.max(...xs) - Math.min(...xs);
}

describe('the GPU canvas draws through the scene camera', () => {
  it('a push-in grows each layer by its own depth, like the exported video', () => {
    const rest = scene(0);
    const pushed = scene(DOLLY);
    const p = cameraMath(sampleTrack).perspectiveOf(50, rest.height);
    const grow = (depth: number) => (p + depth) / (p + depth - DOLLY);

    expect(widthOf(pushed, 'near') / widthOf(rest, 'near')).toBeCloseTo(grow(0), 2);
    expect(widthOf(pushed, 'far') / widthOf(rest, 'far')).toBeCloseTo(grow(FAR), 2);
    expect(stageSpec(rest).rest).toBeCloseTo(p, 6);
  });
});
