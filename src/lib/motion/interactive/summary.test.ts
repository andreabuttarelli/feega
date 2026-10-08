import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { setExpression } from '../expression/ops';
import { setInteractive } from './presets';
import { PlayMode } from './settings';
import { Reaction, reactionsOf } from './summary';

function ok(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function driven(key: string, source: string): MotionDoc {
  const placed = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60 }, 'a'));
  return ok(setExpression(placed, 'a', key, source));
}

describe('what an embed reacts to, in plain words', () => {
  it('a scene animated only by time reacts to nothing', () => {
    expect(reactionsOf(driven('x', 'spring([[0, 0.3], [1.5, 0.5]], time, 140, 24)'))).toEqual([]);
  });

  it('a layer reading the pointer follows the cursor', () => {
    expect(reactionsOf(driven('x', 'value + input.pointer.x - 0.5'))).toEqual([Reaction.Cursor]);
  });

  it('tilt and hover are both named, once each', () => {
    const doc = driven('rotateY', 'value + input.tilt.x * 20 + input.tilt.y + input.hover');
    expect(reactionsOf(doc)).toEqual([Reaction.Hover, Reaction.Tilt]);
  });

  it('scroll scrubbing counts as reacting to scroll', () => {
    expect(reactionsOf(ok(setInteractive(newMotionDoc(MotionFormat.Square), { playback: PlayMode.Scrub })))).toEqual([Reaction.Scroll]);
  });

  it('input.time alone is not interaction', () => {
    expect(reactionsOf(driven('x', 'value + input.time * 0.1'))).toEqual([]);
  });
});
