import { describe, expect, it } from 'vitest';
import { setNetwork, toVector } from './ops';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { COMPONENTS } from '../components';
import { shapeMarkup, type ShapeLook } from '../shape/render';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withShape = (props: Record<string, unknown>) => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props }, 's'));

const paint = { id: 'a', size: { w: 200, h: 100 }, unit: 1000, time: 0, color: (v: string) => v };
const drawn = (doc: MotionDoc) => shapeMarkup(COMPONENTS.Shape.schema.parse(findClip(doc, 's')!.clip.props) as unknown as ShapeLook, paint);

describe('turning a shape into a vector network', () => {
  it('draws exactly what the shape drew', () => {
    const star = withShape({ shape: 'star', points: 5, fills: [{ type: 'solid', color: '#ff0000' }] });
    const vector = ok(toVector(star, 's'));
    expect(findClip(vector, 's')!.clip.props.shape).toBe('vector');
    expect(drawn(vector)).toBe(drawn(star));
  });

  it('an open pen path stays open', () => {
    const pen = withShape({ shape: 'path', path: 'M0 0L0.5 1L1 0' });
    const network = findClip(ok(toVector(pen, 's')), 's')!.clip.props.network as { regions: unknown[] };
    expect(network.regions).toEqual([]);
  });

  it('refuses a clip that is not a shape', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'x' } }, 's'));
    expect(toVector(doc, 's').ok).toBe(false);
  });
});

describe('writing a vector network', () => {
  it('replaces the network and refuses one that names missing vertices', () => {
    const doc = withShape({ shape: 'vector' });
    const zero = { x: 0, y: 0 };
    const good = { vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], segments: [{ start: 0, end: 1, tangentStart: zero, tangentEnd: zero }], regions: [] };
    expect(setNetwork(doc, 's', good).ok).toBe(true);
    expect(setNetwork(doc, 's', { ...good, segments: [{ start: 0, end: 5, tangentStart: zero, tangentEnd: zero }] }).ok).toBe(false);
  });
});
