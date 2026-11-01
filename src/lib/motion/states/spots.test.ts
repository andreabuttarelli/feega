import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { putState } from './ops';
import { StateSpotKind, stateHold, stateSpotsOf } from './spots';
import { statedId } from './stated-comps';
import { createComponent } from '$lib/motion/main-component';
import { addVariant } from '$lib/motion/variants';
import { clipsOf } from '@feega/motion-core/motion/doc';
import { groupClips } from '$lib/motion/group';

describe('state hotspots', () => {
  it('a clip with states gets a box in frame fractions, a clip without none', () => {
    const one = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'a');
    const two = one.ok ? addClip(one.doc, { component: 'Shape', from: 0, durationInFrames: 30 }, 'b') : one;
    const put = two.ok ? putState(two.doc, 'a', { state: ElementState.Hover, overrides: { opacity: 0.5 } }) : two;
    if (!put.ok) {
      throw new Error(put.error);
    }

    const spots = stateSpotsOf(put.doc, { width: 200, height: 100 }, () => ({ left: 20, top: 10, width: 100, height: 50 }));

    expect(spots).toEqual([{ clip: 'a', path: ['a'], kind: StateSpotKind.Rows, box: { left: 0.1, top: 0.1, width: 0.5, height: 0.5 } }]);
  });

  it('an instance whose set has a Hover variant gets a box too', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'pill');
    let n = 0;
    const made = added.ok ? createComponent(added.doc, ['pill'], () => `s${++n}`, 'Button') : added;
    const instance = made.ok ? clipsOf(made.doc)[0] : null;
    const varied = made.ok && instance ? addVariant(made.doc, String(instance.props.comp), { State: 'Hover' }, () => 'hover-comp') : made;
    if (!varied.ok || !instance) {
      throw new Error('setup');
    }

    const spots = stateSpotsOf(varied.doc, { width: 200, height: 100 }, () => ({ left: 0, top: 0, width: 20, height: 10 }));

    expect(spots.map((s) => [s.clip, s.kind])).toEqual([[instance.id, StateSpotKind.Variants]]);
    expect(stateHold(varied.doc, spots[0], ElementState.Hover)).toEqual({ [instance.id]: 'hover-comp' });
  });

  it('a hover inside a group gets its box by the path down to it, as imported pages are built', () => {
    const one = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'a');
    const put = one.ok ? putState(one.doc, 'a', { state: ElementState.Hover, overrides: { opacity: 0.5 } }) : one;
    let n = 0;
    const grouped = put.ok ? groupClips(put.doc, ['a'], () => `g${++n}`) : put;
    if (!grouped.ok) {
      throw new Error('setup');
    }
    const group = clipsOf(grouped.doc)[0].id;
    const asked: string[][] = [];

    const spots = stateSpotsOf(grouped.doc, { width: 200, height: 100 }, (path) => {
      asked.push([...path]);
      return { left: 0, top: 0, width: 20, height: 10 };
    });

    expect(spots.map((s) => s.path)).toEqual([[group, 'a']]);
    expect(asked).toEqual([[group, 'a']]);
  });

  it('an instance whose main has its own hover holds, while hovered, its main drawn hovered', () => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'pill');
    const put = added.ok ? putState(added.doc, 'pill', { state: ElementState.Hover, overrides: { opacity: 0.5 } }) : added;
    let n = 0;
    const made = put.ok ? createComponent(put.doc, ['pill'], () => `m${++n}`, 'Button') : put;
    if (!made.ok) {
      throw new Error('setup');
    }
    const instance = clipsOf(made.doc)[0];

    const spots = stateSpotsOf(made.doc, { width: 200, height: 100 }, () => ({ left: 0, top: 0, width: 20, height: 10 }));

    expect(spots.map((s) => [s.clip, s.kind])).toEqual([[instance.id, StateSpotKind.Main]]);
    expect(stateHold(made.doc, spots[0], ElementState.Hover)).toEqual({ [instance.id]: statedId(String(instance.props.comp), ElementState.Hover) });
    expect(stateHold(made.doc, spots[0], ElementState.Pressed)).toBeNull();
  });
});
