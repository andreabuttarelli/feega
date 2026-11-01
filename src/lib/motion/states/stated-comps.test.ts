import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { createComponent } from '$lib/motion/main-component';
import { putState } from './ops';
import { statedId, withStatedComps } from './stated-comps';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function button(withHover: boolean) {
  const shape = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { fill: '#0066ff' } }, 'pill'));
  const hovered = withHover ? must(putState(shape, 'pill', { state: ElementState.Hover, overrides: { fill: '#003399' } })) : shape;
  let n = 0;
  const doc = must(createComponent(hovered, ['pill'], () => `c${++n}`, 'Button'));
  const main = Object.keys(doc.comps)[0];
  return { doc, main };
}

describe('a main drawn in a state, for the player', () => {
  it('a main whose layer has a hover gets a copy drawn hovered, same layer ids, outside its set', () => {
    const { doc, main } = button(true);
    const stated = withStatedComps(doc).comps[statedId(main, ElementState.Hover)];

    expect(stated.tracks.flatMap((t) => t.clips).map((c) => [c.id, c.props.fill])).toEqual([['pill', '#003399']]);
    expect(stated.component).toBeUndefined();
  });

  it('a main without states gets no copy', () => {
    const { doc, main } = button(false);

    expect(withStatedComps(doc).comps[statedId(main, ElementState.Hover)]).toBeUndefined();
  });
});
