import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { putInteraction } from './ops';
import { reachableFrom } from './reach';

function linking(...targets: string[]) {
  let doc = newMotionDoc(MotionFormat.Landscape);
  targets.forEach((target, i) => {
    const added = addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30 }, `c${i}`);
    if (!added.ok) {
      throw new Error(added.error);
    }
    const put = putInteraction(added.doc, `c${i}`, { id: `i${i}`, trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target } });
    if (!put.ok) {
      throw new Error(put.error);
    }
    doc = put.doc;
  });
  return doc;
}

const leaf = () => newMotionDoc(MotionFormat.Landscape);

describe('reachableFrom', () => {
  it('follows links from the start through every frame it can open', () => {
    const docs = new Map([['a', linking('b')], ['b', linking('c')], ['c', leaf()], ['z', leaf()]]);

    expect(reachableFrom(docs, 'a')).toEqual(['a', 'b', 'c']);
  });

  it('stops at a cycle and skips links to frames that are gone', () => {
    const docs = new Map([['a', linking('b', 'ghost')], ['b', linking('a')]]);

    expect(reachableFrom(docs, 'a')).toEqual(['a', 'b']);
  });

  it('is empty for a start that does not exist', () => {
    expect(reachableFrom(new Map(), 'a')).toEqual([]);
  });
});
