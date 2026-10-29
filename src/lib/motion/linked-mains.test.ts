import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent, instanceOf, overrideInstance } from './main-component';
import { homed, placeInstance } from './canvas-components';
import { linkedMains, mainHomesOf, mainsSignature } from './linked-mains';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `c${++n}`;

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function mainFrame(text = 'Buy now') {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text } }, 'label'));
  const doc = must(createComponent(base, ['label'], newId, 'Button'));
  return { doc, compId: String(clipsOf(doc)[0].props.comp) };
}

function instanceFrame(main: MotionDoc, compId: string) {
  const doc = must(placeInstance(newMotionDoc(MotionFormat.Landscape), homed(main, 'A'), compId, newId));
  return { doc, instanceId: clipsOf(doc)[0].id };
}

const relabel = (doc: MotionDoc, compId: string, text: string): MotionDoc => ({
  ...doc,
  comps: { ...doc.comps, [compId]: { ...doc.comps[compId], tracks: doc.comps[compId].tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => ({ ...c, props: { ...c.props, text } })) })) } }
});

const innerText = (doc: MotionDoc, compId: string) => (doc.comps[compId].tracks[0].clips[0] as MotionClip).props.text;

describe('instances follow their main across frames', () => {
  it('names the frames a copy depends on, never its own', () => {
    const { doc: main, compId } = mainFrame();
    const { doc } = instanceFrame(main, compId);

    expect(mainHomesOf(doc, 'B')).toEqual(['A']);
    expect(mainHomesOf(main, 'A')).toEqual([]);
  });

  it('shows the main as it is now in its home frame', () => {
    const { doc: main, compId } = mainFrame();
    const { doc } = instanceFrame(main, compId);

    const resolved = linkedMains(doc, 'B', new Map([['A', relabel(main, compId, 'Order')]]));

    expect(innerText(resolved, compId)).toBe('Order');
    expect(resolved.comps[compId].component?.home).toBe('A');
  });

  it('keeps the overrides of the instance on top of the edited main', () => {
    const { doc: main, compId } = mainFrame();
    const { doc, instanceId } = instanceFrame(main, compId);
    const overridden = must(overrideInstance(doc, instanceId, 'label', { text: 'Sold out' }));

    const resolved = linkedMains(overridden, 'B', new Map([['A', relabel(main, compId, 'Order')]]));

    expect(instanceOf(resolved, instanceId)!.overrides).toEqual({ label: { text: 'Sold out' } });
    expect(innerText(resolved, compId)).toBe('Order');
  });

  it('keeps the last copy when the home frame is not known', () => {
    const { doc: main, compId } = mainFrame();
    const { doc } = instanceFrame(main, compId);

    expect(linkedMains(doc, 'B', new Map())).toEqual(doc);
  });

  it('detaches the instances, keeping what they showed, when the main is deleted', () => {
    const { doc: main, compId } = mainFrame();
    const { doc, instanceId } = instanceFrame(main, compId);
    const overridden = must(overrideInstance(doc, instanceId, 'label', { text: 'Sold out' }));

    const resolved = linkedMains(overridden, 'B', new Map([['A', null]]));
    const clip = clipsOf(resolved)[0];

    expect(instanceOf(resolved, instanceId)).toBeNull();
    expect(clip.props.overrides).toBeUndefined();
    expect(innerText(resolved, String(clip.props.comp))).toBe('Sold out');
  });

  it('detaches when the home frame no longer holds that main', () => {
    const { doc: main, compId } = mainFrame();
    const { doc, instanceId } = instanceFrame(main, compId);

    const resolved = linkedMains(doc, 'B', new Map([['A', newMotionDoc(MotionFormat.Landscape)]]));

    expect(instanceOf(resolved, instanceId)).toBeNull();
    expect(innerText(resolved, String(clipsOf(resolved)[0].props.comp))).toBe('Buy now');
  });

  it('leaves a copy with no home as it is', () => {
    const { doc: main, compId } = mainFrame();
    const doc = must(placeInstance(newMotionDoc(MotionFormat.Landscape), main, compId, newId));

    expect(mainHomesOf(doc, 'B')).toEqual([]);
    expect(linkedMains(doc, 'B', new Map([['A', relabel(main, compId, 'Order')]]))).toEqual(doc);
  });

  it('keeps the copy when following the main would make it contain itself', () => {
    const { doc: main, compId } = mainFrame();
    const { doc } = instanceFrame(main, compId);
    const inner = main.comps[compId].tracks[0];
    const self = { ...(inner.clips[0] as MotionClip), id: 'loop', component: 'Precomp', props: { comp: compId } } as MotionClip;
    const looped = { ...main, comps: { ...main.comps, [compId]: { ...main.comps[compId], tracks: [inner, { ...inner, id: 't-loop', clips: [self] }] } } };

    const resolved = linkedMains(doc, 'B', new Map([['A', looped]]));

    expect(resolved.comps[compId]).toEqual(doc.comps[compId]);
  });

  it('signs the mains of a frame, so a change to one is told apart from any other save', () => {
    const { doc: main, compId } = mainFrame();
    const moved = must(setTransform(main, clipsOf(main)[0].id, { x: 0.3 }));

    expect(mainsSignature(moved, 'A')).toBe(mainsSignature(main, 'A'));
    expect(mainsSignature(relabel(main, compId, 'Order'), 'A')).not.toBe(mainsSignature(main, 'A'));
    expect(mainsSignature(newMotionDoc(MotionFormat.Landscape), 'A')).toBeNull();
  });
});
