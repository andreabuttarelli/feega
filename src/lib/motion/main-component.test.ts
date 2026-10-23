// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { findClip, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, setProps, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { composeHtml } from './hyperframes/compose';
import { componentOf, createComponent, detachInstance, instanceOf, instanceElements, instanceTexts, Paint, pushOverrides, recolorInstance, overrideInstance, resetOverride, resetOverrides } from './main-component';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `id${++n}`;

function button(): MotionDoc {
  const withBox = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect' } }, 'bg'));
  return must(addClip(withBox, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now' } }, 'label'));
}

const flatText = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Text').map((c) => c.props.text);

describe('main components and instances', () => {
  it('creating a component turns the selection into a main and leaves one instance in place', () => {
    const made = createComponent(button(), ['bg', 'label'], newId, 'Button');
    const doc = must(made);
    const instance = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    expect(componentOf(doc, instance)?.name).toBe('Button');
    expect(instanceOf(doc, instance.id)).not.toBeNull();
  });

  it('an override changes one instance only, and both renderers see it', () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const first = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    const second = { ...first, id: 'copy' };
    const two = { ...doc, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [...t.clips, second] } : t)) };
    const overridden = must(overrideInstance(two, 'copy', 'label', { text: 'Sold out' }));

    expect(flatText(overridden).sort()).toEqual(['Buy now', 'Sold out']);
    expect(composeHtml({ doc: overridden, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' })).toContain('Sold out');
  });

  it('editing the main reaches every instance that did not override it', () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const instance = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    const compId = String(instance.props.comp);
    const edited = { ...doc, comps: { ...doc.comps, [compId]: { ...doc.comps[compId], tracks: doc.comps[compId].tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'label' ? { ...c, props: { ...c.props, text: 'Order' } } : c)) })) } } };
    expect(flatText(edited)).toEqual(['Order']);
  });

  it('refuses an override for an element the main does not have', () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const instance = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    expect(overrideInstance(doc, instance.id, 'nope', { text: 'x' }).ok).toBe(false);
  });

  it('reset drops the overrides; detach keeps the look but leaves the component', () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const id = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id;
    const overridden = must(overrideInstance(doc, id, 'label', { text: 'Sold out' }));

    expect(flatText(must(resetOverrides(overridden, id)))).toEqual(['Buy now']);
    const detached = must(detachInstance(overridden, id, newId));
    expect(instanceOf(detached, id)).toBeNull();
    expect(flatText(detached)).toEqual(['Sold out']);
    expect(findClip(detached, id)!.clip.props.overrides).toBeUndefined();
  });
});

describe('the instance properties a person can override', () => {
  it('lists the texts of the main with the instance value and whether it is overridden', () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const id = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id;
    const overridden = must(overrideInstance(doc, id, 'label', { text: 'Sold out' }));

    expect(instanceTexts(overridden, id)).toEqual([{ innerId: 'label', value: 'Sold out', main: 'Buy now', overridden: true }]);
  });
});

describe('overrides beyond text', () => {
  const made = () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    return { doc, id: doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id };
  };
  const flat = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]);

  it('hiding an element in one instance removes it from both renderers', () => {
    const { doc, id } = made();
    const hidden = must(overrideInstance(doc, id, 'bg', { hidden: true }));

    expect(flat(hidden).some((c) => c.id.endsWith('bg'))).toBe(false);
    expect(flat(doc).some((c) => c.id.endsWith('bg'))).toBe(true);
  });

  it('an effects override replaces the effects of the element, not its props', () => {
    const { doc, id } = made();
    const plain = must(overrideInstance(doc, id, 'bg', { effects: [] }));

    expect(flat(plain).find((c) => c.id.endsWith('bg'))!.effects).toEqual([]);
    expect(flat(plain).find((c) => c.id.endsWith('bg'))!.props.effects).toBeUndefined();
  });

  it('a fill override recolours the instance and detach bakes it in', () => {
    const { doc, id } = made();
    const fills = [{ type: 'solid', color: '#ff0000', opacity: 1, visible: true, blend: 'normal' }];
    const red = must(overrideInstance(doc, id, 'bg', { fills }));

    expect(flat(red).find((c) => c.id.endsWith('bg'))!.props.fills).toEqual(fills);
    expect(flat(must(detachInstance(red, id, newId))).find((c) => c.id.endsWith('bg'))!.props.fills).toEqual(fills);
  });

  it('resets one property and keeps the others', () => {
    const { doc, id } = made();
    const both = must(overrideInstance(must(overrideInstance(doc, id, 'bg', { hidden: true })), id, 'label', { text: 'Sold out' }));
    const back = must(resetOverride(both, id, 'bg', 'hidden'));

    expect(instanceOf(back, id)!.overrides).toEqual({ label: { text: 'Sold out' } });
    expect(instanceOf(must(resetOverride(back, id, 'label', 'text')), id)!.clip.props.overrides).toBeUndefined();
  });

  it('lists each element with the properties it overrides', () => {
    const { doc, id } = made();
    const hidden = must(overrideInstance(doc, id, 'bg', { hidden: true }));
    const bg = instanceElements(hidden, id).find((e) => e.innerId === 'bg')!;

    expect(bg.hidden).toBe(true);
    expect(bg.overridden).toEqual(['hidden']);
    expect(instanceElements(hidden, id).find((e) => e.innerId === 'label')!.overridden).toEqual([]);
  });

  it('recolours the first fill and keeps its other settings', () => {
    const fills = [{ type: 'solid', color: '#111111', opacity: 0.5, visible: true, blend: 'normal' }];
    const base = must(setProps(button(), 'bg', { fills }));
    const doc = must(createComponent(base, ['bg', 'label'], newId, 'Button'));
    const id = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id;
    const red = must(recolorInstance(doc, id, 'bg', Paint.Fill, '#ff0000'));

    expect(instanceOf(red, id)!.overrides.bg.fills).toEqual([{ ...fills[0], color: '#ff0000' }]);
    expect(recolorInstance(doc, id, 'label', Paint.Stroke, '#fff').ok).toBe(false);
  });
});

describe('pushing instance changes to the main', () => {
  const twoInstances = () => {
    const doc = must(createComponent(button(), ['bg', 'label'], newId, 'Button'));
    const first = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    const second = { ...first, id: 'copy' };
    return { doc: { ...doc, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [...t.clips, second] } : t)) }, first: first.id };
  };
  const texts = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Text').map((c) => c.props.text);

  it('makes the override the main value for every instance and clears it here', () => {
    const { doc, first } = twoInstances();
    const edited = must(overrideInstance(doc, first, 'label', { text: 'Order' }));
    const pushed = must(pushOverrides(edited, first));

    expect(texts(pushed)).toEqual(['Order', 'Order']);
    expect(instanceOf(pushed, first)!.clip.props.overrides).toBeUndefined();
  });

  it('keeps what another instance overrides itself', () => {
    const { doc, first } = twoInstances();
    const other = must(overrideInstance(doc, 'copy', 'label', { text: 'Mine' }));
    const pushed = must(pushOverrides(must(overrideInstance(other, first, 'label', { text: 'Order' })), first));

    expect(texts(pushed).sort()).toEqual(['Mine', 'Order']);
  });

  it('pushes clip-level properties too', () => {
    const { doc, first } = twoInstances();
    const pushed = must(pushOverrides(must(overrideInstance(doc, first, 'bg', { hidden: true })), first));

    expect(flattenComps(pushed).tracks.flatMap((t) => t.clips).some((c) => c.id.endsWith('bg'))).toBe(false);
  });

  it('refuses a clip that is not an instance', () => {
    expect(pushOverrides(button(), 'bg').ok).toBe(false);
  });
});
