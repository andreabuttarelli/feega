// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { findClip, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps } from './precomp';
import { composeHtml } from './hyperframes/compose';
import { componentOf, createComponent, detachInstance, instanceOf, instanceTexts, overrideInstance, resetOverrides } from './main-component';

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
