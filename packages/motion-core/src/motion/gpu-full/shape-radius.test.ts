import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { ItemKind, drawFrame, prepare } from './display-list';

const SHAPE = { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color: '#ff6a3d' }] };

function stored(odd: object): unknown {
  const base: MotionDoc = { ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 };
  const doc = ['odd', 'plain'].reduce((d, id) => {
    const next = addClip(d, { component: 'Shape', from: 0, durationInFrames: 30, props: SHAPE }, id);
    if (!next.ok) {
      throw new Error(next.error);
    }
    return next.doc;
  }, base);
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'odd' ? { ...c, props: { ...SHAPE, ...odd } } : c)) })) };
}

function loaded(odd: object): MotionDoc {
  const verdict = parseMotionDoc(stored(odd));
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

const pathsOf = (doc: MotionDoc, clip: string) => drawFrame(prepare(doc, FEEGA_TOKENS), 0).items.filter((i) => i.kind === ItemKind.Path && i.clip === clip);

describe('a stored Shape with a prop the schema does not take', () => {
  it.each([
    ['a single radius', { radius: 24 }],
    ['per-corner radii', { radius: [4, 8, 12, 16] }],
    ['a roundness of the wrong type', { roundness: 'round' }]
  ])('%s still loads, and every clip of the frame draws', (_, odd) => {
    const doc = loaded(odd);

    expect(pathsOf(doc, 'plain').length).toBeGreaterThan(0);
    expect(pathsOf(doc, 'odd').length).toBeGreaterThan(0);
  });

  it('per-corner corners keep their radii', () => {
    const doc = loaded({ corners: [0.1, 0.2, 0.3, 0.4] });

    expect(doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'odd')?.props.corners).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
