import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { createComponent, instanceOf } from './main-component';
import { addVariant } from './variants';
import { componentGroups, placeInstance } from './canvas-components';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `c${++n}`;

function frameWithButton() {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now' } }, 'label'));
  const doc = must(createComponent(base, ['label'], newId, 'Button'));
  const instance = doc.tracks.flatMap((t) => t.clips)[0] as MotionClip;
  return { doc, compId: String(instance.props.comp) };
}

describe('components on a canvas', () => {
  it('lists the mains of every frame, a variant set as one entry', () => {
    const { doc, compId } = frameWithButton();
    const withVariant = must(addVariant(doc, compId, { State: 'Hover' }, newId));

    const groups = componentGroups([{ id: 'f1', doc: withVariant }, { id: 'f2', doc: newMotionDoc(MotionFormat.Landscape) }]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ frameId: 'f1', name: 'Button' });
    expect(groups[0].variants.map((v) => v.variant)).toEqual([{ State: 'Default' }, { State: 'Hover' }]);
  });

  it('lists a main once, even after a copy of it was inserted into another frame', () => {
    const { doc: source, compId } = frameWithButton();
    const copy = must(placeInstance(newMotionDoc(MotionFormat.Landscape), source, compId, newId));

    expect(componentGroups([{ id: 'f1', doc: source }, { id: 'f2', doc: copy }]).map((g) => g.frameId)).toEqual(['f1']);
  });

  it('inserts an instance of a main from another frame, copying the main once', () => {
    const { doc: source, compId } = frameWithButton();
    const target = newMotionDoc(MotionFormat.Landscape);

    const placed = must(placeInstance(target, source, compId, newId));
    const again = must(placeInstance(placed, source, compId, newId));
    const instances = again.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Precomp');

    expect(Object.keys(again.comps)).toEqual([compId]);
    expect(instances).toHaveLength(2);
    expect(instanceOf(again, instances[0].id)).not.toBeNull();
    expect(flattenComps(again).tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Text')).toHaveLength(2);
  });

  it('inserts into the frame that owns the main without copying anything', () => {
    const { doc, compId } = frameWithButton();

    const placed = must(placeInstance(doc, doc, compId, newId));

    expect(Object.keys(placed.comps)).toEqual([compId]);
    expect(placed.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp')).toHaveLength(2);
  });

  it('puts the instance where it was dropped, as a share of the frame from its centre', () => {
    const { doc: source, compId } = frameWithButton();

    const placed = must(placeInstance(newMotionDoc(MotionFormat.Landscape), source, compId, newId, { x: 0.25, y: -0.1 }));
    const instance = placed.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;

    expect(instance.transform).toMatchObject({ x: 0.25, y: -0.1 });
  });

  it('refuses something that is not a main component', () => {
    const { doc } = frameWithButton();

    expect(placeInstance(doc, doc, 'nope', newId).ok).toBe(false);
  });
});
