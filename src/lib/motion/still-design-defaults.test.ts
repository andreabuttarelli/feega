import { describe, expect, it } from 'vitest';
import { Background, MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { designStill } from './still';

const video = newMotionDoc(MotionFormat.Square);
const still: MotionDoc = { ...video, still: { frame: 0 } };

const clipOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips)[0];

describe('a still frame is designed, not timed', () => {
  it('a clip added to a still spans the whole doc, whatever time it was asked at', () => {
    const added = addClip(still, { component: 'Title', props: {}, from: 30, durationInFrames: 90 }, 'c');

    expect(added.ok && clipOf(added.doc)).toMatchObject({ from: 0, durationInFrames: still.durationInFrames });
  });

  it('a clip added to a video keeps its time', () => {
    const added = addClip(video, { component: 'Title', props: {}, from: 30, durationInFrames: 90 }, 'c');

    expect(added.ok && clipOf(added.doc)).toMatchObject({ from: 30, durationInFrames: 90 });
  });

  it('a video made a still drops the brand background for a transparent one', () => {
    const made = designStill({ ...video, background: Background.Brand }, 0);

    expect(made.ok && made.doc).toMatchObject({ still: { frame: 0 }, background: Background.Transparent });
  });

  it('a still that is moved keeps the background it has', () => {
    const moved = designStill({ ...still, background: Background.Brand }, 0);

    expect(moved.ok && moved.doc.background).toBe(Background.Brand);
  });
});
