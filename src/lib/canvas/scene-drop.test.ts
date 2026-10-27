import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { sequenceScenes } from '$lib/motion/scenes';
import { sceneDrop } from './scene-drop';

const SOURCE = '11111111-1111-4111-8111-111111111111';
const SEQUENCE = '22222222-2222-4222-8222-222222222222';
const PLAIN = '33333333-3333-4333-8333-333333333333';

const plain = newMotionDoc(MotionFormat.Landscape);
const sequence = sequenceScenes(plain, [{ nodeId: PLAIN, durationInFrames: 60 }]);
const docs: Record<string, MotionDoc> = { [SOURCE]: plain, [SEQUENCE]: sequence, [PLAIN]: plain };
const docOf = (id: string) => docs[id] ?? null;
const over = (frameId: string) => ({ frameId, at: { x: 0.4, y: 0.5 } });

describe('dragging a frame onto a sequence frame', () => {
  it('becomes a scene insert at the horizontal drop position', () => {
    expect(sceneDrop([SOURCE], docOf, over(SEQUENCE))).toEqual({ targetId: SEQUENCE, sourceId: SOURCE, at: 0.4 });
  });

  it('leaves a drop on an ordinary frame to the normal move', () => {
    expect(sceneDrop([SOURCE], docOf, over(PLAIN))).toBeNull();
  });

  it('ignores a sequence dragged onto a sequence, a multi-selection and a drop on nothing', () => {
    expect(sceneDrop([SEQUENCE], docOf, over(SEQUENCE))).toBeNull();
    expect(sceneDrop([PLAIN], (id) => (id === PLAIN ? sequence : sequence), over(SEQUENCE))).toBeNull();
    expect(sceneDrop([SOURCE, PLAIN], docOf, over(SEQUENCE))).toBeNull();
    expect(sceneDrop([SOURCE], docOf, null)).toBeNull();
  });

  it('waits for docs it has not loaded', () => {
    expect(sceneDrop(['missing'], docOf, over(SEQUENCE))).toBeNull();
    expect(sceneDrop([SOURCE], docOf, over('missing'))).toBeNull();
  });
});
