import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { putInteraction } from './ops';
import { prototypeLinks } from './links';

function linked(target: string, action: ActionKind = ActionKind.Navigate) {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  const put = putInteraction(added.doc, 'c1', { id: 'i1', trigger: { kind: TriggerKind.Click }, action: action === ActionKind.Back ? { kind: ActionKind.Back } : { kind: action, target } } as never);
  if (!put.ok) {
    throw new Error(put.error);
  }
  return put.doc;
}

describe('prototypeLinks', () => {
  it('lists an arrow from the source frame to a frame that exists on the canvas', () => {
    const docs = new Map([['a', linked('b')], ['b', newMotionDoc(MotionFormat.Landscape)]]);

    expect(prototypeLinks(docs)).toEqual([{ id: 'i1', clip: 'c1', from: 'a', to: 'b', trigger: TriggerKind.Click, action: ActionKind.Navigate }]);
  });

  it('skips links to frames that are gone and actions without a target frame', () => {
    expect(prototypeLinks(new Map([['a', linked('gone')]]))).toEqual([]);
    expect(prototypeLinks(new Map([['a', linked('', ActionKind.Back)]]))).toEqual([]);
  });
});
