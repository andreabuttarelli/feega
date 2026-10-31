import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { putState } from './ops';
import { stateSpotsOf } from './spots';
import { createComponent } from '$lib/motion/main-component';
import { addVariant } from '$lib/motion/variants';
import { clipsOf } from '@feega/motion-core/motion/doc';

describe('state hotspots', () => {
  it('a clip with states gets a box in frame fractions, a clip without none', () => {
    const one = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'a');
    const two = one.ok ? addClip(one.doc, { component: 'Shape', from: 0, durationInFrames: 30 }, 'b') : one;
    const put = two.ok ? putState(two.doc, 'a', { state: ElementState.Hover, overrides: { opacity: 0.5 } }) : two;
    if (!put.ok) {
      throw new Error(put.error);
    }

    const spots = stateSpotsOf(put.doc, { width: 200, height: 100 }, () => ({ left: 20, top: 10, width: 100, height: 50 }));

    expect(spots).toEqual([{ clip: 'a', box: { left: 0.1, top: 0.1, width: 0.5, height: 0.5 } }]);
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

    expect(spots.map((s) => s.clip)).toEqual([instance.id]);
  });
});
