import { describe, expect, it } from 'vitest';
import { TrackKind } from '@feega/motion-core/motion/components';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, addTrack, type OpResult } from '@feega/motion-core/motion/timeline';
import { removeLayers } from './remove-layers';

function must(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const layered = (ids: readonly string[]) =>
  ids.reduce((doc, id) => must(addClip(must(addTrack(doc, TrackKind.Visual, `t-${id}`)), { component: 'Shape', from: 0, durationInFrames: 30, trackId: `t-${id}`, props: { shape: 'rect' } }, id)), newMotionDoc(MotionFormat.Landscape));

describe('deleting layers', () => {
  it('frees the tracks the deleted layers held, so a frame never fills up with empty ones', () => {
    const doc = layered(['a', 'b', 'c']);

    const left = must(removeLayers(doc, ['a', 'b']));

    expect(left.tracks.map((t) => t.id)).toEqual(['t-c', 'v1', 'a1']);
  });

  it('keeps a track that was already empty before the delete', () => {
    const left = must(removeLayers(layered(['a']), ['a']));

    expect(left.tracks.map((t) => t.id)).toEqual(['v1', 'a1']);
  });
});
