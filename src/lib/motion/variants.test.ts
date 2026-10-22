import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { createComponent, overrideInstance } from './main-component';
import { addVariant, pickVariant, swapInstance, variantProps } from './variants';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `v${++n}`;

function made() {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now' } }, 'label'));
  const doc = must(createComponent(base, ['label'], newId, 'Button'));
  const instance = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
  return { doc, instanceId: instance.id, mainId: String(instance.props.comp) };
}

const flatText = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Text').map((c) => c.props.text);

describe('variants and instance swap', () => {
  it('a variant joins the main in one set, keeping the inner ids', () => {
    const { doc, mainId } = made();
    const next = must(addVariant(doc, mainId, { State: 'Hover' }, newId));
    expect(variantProps(next, mainId)).toEqual({ State: ['Default', 'Hover'] });
    const ids = Object.values(next.comps).map((c) => c.tracks.flatMap((t) => t.clips.map((x) => x.id)));
    expect(ids).toEqual([['label'], ['label']]);
  });

  it('picking a variant swaps the instance and keeps its overrides', () => {
    const { doc, mainId, instanceId } = made();
    const withHover = must(addVariant(doc, mainId, { State: 'Hover' }, newId));
    const overridden = must(overrideInstance(withHover, instanceId, 'label', { text: 'Sold out' }));
    const swapped = must(pickVariant(overridden, instanceId, 'State', 'Hover'));
    const comp = String(findClip(swapped, instanceId)!.clip.props.comp);

    expect(swapped.comps[comp].component?.variant).toEqual({ State: 'Hover' });
    expect(flatText(swapped)).toEqual(['Sold out']);
  });

  it('swap refuses a composition that is not a component', () => {
    const { doc, instanceId } = made();
    expect(swapInstance(doc, instanceId, 'nope').ok).toBe(false);
  });
});
