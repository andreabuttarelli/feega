import { describe, expect, it } from 'vitest';
import { MotionFormat, clipsOf, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { createComponent } from '$lib/motion/main-component';
import { addVariant } from '$lib/motion/variants';
import { putState } from './ops';
import { previewDoc } from './preview';
import { stateSpotsOf, statesUnder } from './spots';

const SIZE = { width: 200, height: 100 };
const BOX = () => ({ left: 0, top: 0, width: 20, height: 10 });

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function cardWithButton(pillState: boolean): { doc: MotionDoc; button: string; buttonComp: string } {
  let n = 0;
  const newId = () => `id${++n}`;
  const added = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'pill'));
  const stated = pillState ? must(putState(added, 'pill', { state: ElementState.Hover, overrides: { opacity: 0.4 } })) : added;
  const withButton = must(createComponent(stated, ['pill'], newId, 'Button'));
  const button = clipsOf(withButton)[0];
  const withCard = must(createComponent(withButton, [button.id], newId, 'Card'));
  return { doc: withCard, button: button.id, buttonComp: String(button.props.comp) };
}

const flat = (doc: MotionDoc, id: string) => clipsOf(flattenComps(doc)).find((c) => c.id === id);
const scoped = (doc: MotionDoc, id: string) => clipsOf(flattenComps(doc)).find((c) => c.id.endsWith(`__${id}`))!.id;

describe('states on an element nested inside instances', () => {
  it('a stated element inside a Button inside a Card gets a hotspot', () => {
    const { doc } = cardWithButton(true);

    expect(stateSpotsOf(doc, SIZE, BOX).map((s) => s.clip)).toEqual([scoped(doc, 'pill')]);
  });

  it('hovering it draws only that instance in its state, the component stays untouched', () => {
    const { doc, buttonComp } = cardWithButton(true);
    const pill = scoped(doc, 'pill');

    const shown = previewDoc(doc, { [pill]: { state: ElementState.Hover, amount: 1 } });

    expect(flat(shown, pill)!.transform.opacity).toBe(0.4);
    expect(shown.comps[buttonComp]).toBe(doc.comps[buttonComp]);
    expect(flat(doc, pill)!.transform.opacity).toBeUndefined();
  });

  it('a nested instance whose set has a Hover variant swaps to it', () => {
    const { doc: base, button, buttonComp } = cardWithButton(false);
    const doc = must(addVariant(base, buttonComp, { State: 'Hover' }, () => 'hover-comp'));
    const inner = scoped(doc, button);

    expect(stateSpotsOf(doc, SIZE, BOX).map((s) => s.clip)).toEqual([inner]);

    const shown = previewDoc(doc, { [inner]: { state: ElementState.Hover, amount: 1 } });

    expect(flat(shown, inner)!.props.comp).toBe('hover-comp');
  });
});

describe('which states the pointer is in', () => {
  const spots = [
    { clip: 'card', box: { left: 0, top: 0, width: 1, height: 1 } },
    { clip: 'card__0__btn', box: { left: 0.2, top: 0.2, width: 0.2, height: 0.2 } },
    { clip: 'other', box: { left: 0.1, top: 0.1, width: 0.5, height: 0.5 } }
  ];
  const parents = new Map([['card__0__btn', 'card']]);

  it('the innermost spot under the pointer and its ancestors, not an unrelated overlap', () => {
    expect(statesUnder(spots, parents, { x: 0.3, y: 0.3 }).sort()).toEqual(['card', 'card__0__btn']);
  });

  it('outside the inner one only the outer is in its state', () => {
    expect(statesUnder(spots, parents, { x: 0.9, y: 0.9 })).toEqual(['card']);
  });

  it('nothing under the pointer, nothing in a state', () => {
    expect(statesUnder(spots, parents, { x: 2, y: 2 })).toEqual([]);
  });
});
