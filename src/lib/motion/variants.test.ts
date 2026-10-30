import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { createComponent, overrideInstance } from './main-component';
import { addVariant, appendVariant, defineVariantProp, pickVariant, setVariant, swapInstance, variantMatrix, variantProps } from './variants';

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

  it('the canvas plus adds the next numbered value of the first property, as Figma does', () => {
    const { doc, mainId } = made();
    const once = must(appendVariant(doc, mainId, newId));
    const twice = must(appendVariant(once, mainId, newId));

    expect(variantProps(twice, mainId)).toEqual({ Variant: ['Default', 'Variant 2', 'Variant 3'] });
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

  it('defining two axes fills the whole matrix', () => {
    const { doc, mainId } = made();
    const sized = must(defineVariantProp(doc, mainId, 'Size', ['S', 'M', 'L'], newId));
    const full = must(defineVariantProp(sized, mainId, 'State', ['default', 'hover'], newId));

    expect(variantProps(full, mainId)).toEqual({ Size: ['S', 'M', 'L'], State: ['default', 'hover'] });
    expect(variantMatrix(full, mainId).cells).toHaveLength(6);
    expect(variantMatrix(full, mainId).cells.every((c) => c.compId !== null)).toBe(true);
  });

  it('defining an axis twice adds only the new values', () => {
    const { doc, mainId } = made();
    const once = must(defineVariantProp(doc, mainId, 'Size', ['S', 'M'], newId));
    const twice = must(defineVariantProp(once, mainId, 'Size', ['S', 'M', 'L'], newId));

    expect(variantMatrix(twice, mainId).cells).toHaveLength(3);
  });

  it('the matrix lists a hole as an empty cell', () => {
    const { doc, mainId } = made();
    const sized = must(defineVariantProp(doc, mainId, 'Size', ['S', 'M'], newId));
    const hover = must(addVariant(sized, mainId, { State: 'Hover' }, newId));

    const cells = variantMatrix(hover, mainId).cells;
    expect(cells.some((c) => c.compId === null)).toBe(true);
  });

  it('setting two axes at once swaps once and keeps overrides', () => {
    const { doc, mainId, instanceId } = made();
    const full = must(defineVariantProp(must(defineVariantProp(doc, mainId, 'Size', ['S', 'L'], newId)), mainId, 'State', ['default', 'hover'], newId));
    const overridden = must(overrideInstance(full, instanceId, 'label', { text: 'Sold out' }));
    const next = must(setVariant(overridden, instanceId, { Size: 'L', State: 'hover' }));
    const comp = String(findClip(next, instanceId)!.clip.props.comp);

    expect(next.comps[comp].component?.variant).toEqual({ Size: 'L', State: 'hover' });
    expect(flatText(next)).toEqual(['Sold out']);
  });

  it('setting a combination that does not exist is refused', () => {
    const { doc, mainId, instanceId } = made();
    const sized = must(defineVariantProp(doc, mainId, 'Size', ['S', 'M'], newId));
    expect(setVariant(sized, instanceId, { Size: 'XL' }).ok).toBe(false);
  });
});
