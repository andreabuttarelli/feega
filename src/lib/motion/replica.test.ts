import { describe, expect, it } from 'vitest';
import { FORMATS, MotionFormat, newMotionDoc } from './doc';
import { addClip } from './timeline';
import { REPLICA_BRIEF, VideoKind, asksReplica, replicaCanvas, replicaFormat, videoKindOf } from './replica';

describe('a request to recreate a reference video', () => {
  it.each(['Recreate this video as faithfully as possible', 'replicate it', 'remake this one', 'ricrea questo video', 'Recrea este vídeo', 'refais cette vidéo'])('"%s" asks for a replica', (message) => {
    expect(asksReplica(message)).toBe(true);
  });

  it('a new video inspired by nothing is not a replica', () => {
    expect(asksReplica('Make a launch teaser for our app')).toBe(false);
  });

  it('only a turn carrying a video reference turns a video into a replica, and it stays one', () => {
    expect(videoKindOf({ message: 'Recreate this video', videoAttached: true, stored: undefined })).toBe(VideoKind.Replica);
    expect(videoKindOf({ message: 'Recreate this video', videoAttached: false, stored: undefined })).toBe(VideoKind.Standard);
    expect(videoKindOf({ message: 'Build the video from the script.', videoAttached: false, stored: VideoKind.Replica })).toBe(VideoKind.Replica);
  });
});

describe('the replica takes the reference canvas', () => {
  it('a 16:9 reference gives a 16:9 video, not the 9:16 default (live test: Cautiva came out portrait)', () => {
    expect(replicaFormat({ width: 1920, height: 1080 })).toBe(MotionFormat.Landscape);
    expect(replicaFormat({ width: 1280, height: 720 })).toBe(MotionFormat.Landscape);
    expect(replicaFormat({ width: 720, height: 1280 })).toBe(MotionFormat.Vertical);
    expect(replicaFormat({ width: 1000, height: 1000 })).toBe(MotionFormat.Square);
    expect(replicaFormat({ width: 1080, height: 1350 })).toBe(MotionFormat.Portrait);
  });

  it('an empty doc gets the reference format and duration', () => {
    const doc = newMotionDoc(MotionFormat.Vertical);
    const out = replicaCanvas(doc, { format: MotionFormat.Landscape, durationS: 10.1 });

    expect(out?.width).toBe(FORMATS[MotionFormat.Landscape].width);
    expect(out?.height).toBe(FORMATS[MotionFormat.Landscape].height);
    expect(out?.durationInFrames).toBe(Math.round(10.1 * doc.fps));
  });

  it('a doc already built is left alone', () => {
    const blank = newMotionDoc(MotionFormat.Vertical);
    const added = addClip(blank, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 'a');
    if (!added.ok) {
      throw new Error(added.error);
    }

    expect(replicaCanvas(added.doc, { format: MotionFormat.Landscape, durationS: 10 })).toBeNull();
  });

  it('the brief asks for scene-by-scene fidelity and no empty span', () => {
    ['scene by scene', 'hex', 'condensed', 'transition', 'camera', 'black'].forEach((word) => expect(REPLICA_BRIEF.toLowerCase()).toContain(word));
  });
});
