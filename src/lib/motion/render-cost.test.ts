import { describe, expect, it } from 'vitest';
import { FLAT_FRAME_MS, costSpans, frameCosts } from './render-cost';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import type { ComponentId } from './components';
import { addEffect } from './effects/ops';
import { EffectKind } from './effects/registry';
import { Matte } from './mask';
import { precompose } from './precomp';

function withClip(doc: MotionDoc, component: ComponentId, from: number, durationInFrames: number): MotionDoc {
  const added = addClip(doc, { component, from, durationInFrames }, `${component}-${from}`);
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('render cost', () => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 };

  it('a flat doc costs the same on every frame', () => {
    const costs = frameCosts(doc.durationInFrames, costSpans(doc));

    expect(new Set(costs)).toEqual(new Set([FLAT_FRAME_MS]));
  });

  it('a device mockup makes its own frames heavier, and only those', () => {
    const costs = frameCosts(doc.durationInFrames, costSpans(withClip(doc, 'Device3D', 60, 90)));

    expect(costs[59]).toBe(FLAT_FRAME_MS);
    expect(costs[60]).toBeGreaterThan(10 * FLAT_FRAME_MS);
    expect(costs[149]).toBe(costs[60]);
    expect(costs[150]).toBe(FLAT_FRAME_MS);
  });

  it('a device on a 4K frame costs more than on a 1080p one', () => {
    const device = withClip(doc, 'Device3D', 0, 30);
    const fhd = frameCosts(30, costSpans(device))[0];
    const uhd = frameCosts(30, costSpans(device, 3840 * 2160))[0];

    expect(uhd).toBeGreaterThan(fhd);
  });
});

type Op = { ok: true; doc: MotionDoc } | { ok: false; error: string };

function ok(result: Op): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

describe('what makes a 2D frame heavy', () => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 90 };
  const first = (d: MotionDoc) => frameCosts(d.durationInFrames, costSpans(d))[0];
  const shape = withClip(doc, 'Shape', 0, 90);
  const stroked = ok(addEffect(shape, 'Shape-0', EffectKind.Stroke, 'e1'));
  const card = ok(precompose(stroked, ['Shape-0'], { comp: 'c1', clip: 'p1' }, 'card'));

  function ring(media: unknown[]): MotionDoc {
    return ok(addClip(card, { component: 'Composition', from: 0, durationInFrames: 90, props: { layout: 'ring', media, layoutParams: { count: 6 } } }, 'r'));
  }

  it('every effect on a clip adds to its frames', () => {
    const twice = ok(addEffect(stroked, 'Shape-0', EffectKind.DropShadow, 'e2'));

    expect(first(stroked)).toBeGreaterThan(first(shape));
    expect(first(twice)).toBeGreaterThan(first(stroked));
  });

  it('a track matte costs a raster of its source on every frame', () => {
    const matted = { ...shape, tracks: shape.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, matte: Matte.Alpha })) })) };

    expect(first(matted)).toBeGreaterThan(first(shape));
  });

  it('a precomp costs what it plays, nested ones included', () => {
    const outer = ok(precompose(card, ['p1'], { comp: 'c2', clip: 'p2' }, 'outer'));

    expect(first(card)).toBe(first(stroked));
    expect(first(outer)).toBe(first(stroked));
  });

  it('a ring pays every card once per slice, a comp card its whole content in each', () => {
    const images = ring([{ assetId: 'a', kind: 'image' }]);
    const comps = ring([{ assetId: 'c1', kind: 'comp' }]);

    expect(first(images)).toBeGreaterThan(first(card));
    expect(first(comps)).toBeGreaterThan(first(images));
  });

  it.each([
    [6, 280],
    [12, 277]
  ])('a ring of %i cards costs what one worker measured on 2026-10-06, %i ms a frame, within ±50%', (count, measuredMs) => {
    const plain = ok(precompose(shape, ['Shape-0'], { comp: 'c1', clip: 'p1' }, 'card'));
    const bare = { ...plain, tracks: plain.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== 'p1') })) };
    const ringed = ok(addClip(bare, { component: 'Composition', from: 0, durationInFrames: 90, props: { layout: 'ring', media: [{ assetId: 'c1', kind: 'comp' }], layoutParams: { count } } }, 'r'));

    expect(first(ringed) / measuredMs).toBeGreaterThan(0.5);
    expect(first(ringed) / measuredMs).toBeLessThan(1.5);
  });
});

describe('composition layouts', () => {
  it('a WebGL composition costs its layout on every frame, a heavier layout more', () => {
    const base = { ...newMotionDoc(MotionFormat.Vertical), durationInFrames: 30 };
    const cost = (layout: string) => frameCosts(30, costSpans(ok(addClip(base, { component: 'Composition', from: 0, durationInFrames: 30, props: { layout, media: [] } }, 'c'))))[0];

    expect(cost('globe')).toBeGreaterThan(FLAT_FRAME_MS);
    expect(cost('masonry')).toBeGreaterThan(cost('globe'));
  });
});
