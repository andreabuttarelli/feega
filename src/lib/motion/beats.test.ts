import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, trimClip, ClipEdge, type OpResult } from './timeline';
import { ANALYSIS_VERSION, type AudioAnalysis } from './audio-analysis';
import { Hit, cutToBeat, hitFrames, markHits } from './beats';
import { MAX_MARKERS } from './doc';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const music: AudioAnalysis = {
  version: ANALYSIS_VERSION,
  fps: 30,
  duration: 20,
  amp: [],
  onsets: [0.1, 1.3],
  bpm: 120,
  beats: Array.from({ length: 40 }, (_, i) => i * 0.5),
  speech: []
};

function scene(): MotionDoc {
  const base = { ...newMotionDoc(MotionFormat.Vertical), durationInFrames: 300 };
  const withMusic = must(addClip(base, { component: 'Audio', from: 30, durationInFrames: 240, props: { assetId: 'm' } }, 'music'));
  return must(trimClip(withMusic, 'music', ClipEdge.Start, 45));
}

const analyses = { m: music };

describe('hitFrames', () => {
  it('maps the beats of each music clip onto the timeline through its start and trim', () => {
    const frames = hitFrames(scene(), analyses, Hit.Beats);

    expect(frames.slice(0, 3)).toEqual([45, 60, 75]);
    expect(frames.every((f) => f >= 45 && f < 270)).toBe(true);
  });

  it('onsets too', () => {
    expect(hitFrames(scene(), analyses, Hit.Onsets)).toEqual([69]);
  });

  it('beats come from the music bed, not from a voice-over with a tempo of its own', () => {
    const voice = { ...music, duration: 3, beats: [0.1, 0.4], onsets: [0.2] };
    const withVo = must(addClip(scene(), { component: 'Audio', from: 0, durationInFrames: 60, trackId: undefined, props: { assetId: 'v' } }, 'vo'));

    expect(hitFrames(withVo, { ...analyses, v: voice }, Hit.Beats).slice(0, 2)).toEqual([45, 60]);
  });

  it('a clip without an analysis has no beats', () => {
    expect(hitFrames(scene(), {}, Hit.Beats)).toEqual([]);
  });
});

describe('cutToBeat', () => {
  function cuts(): MotionDoc {
    let doc = scene();
    for (const [id, from, length] of [
      ['a', 50, 40],
      ['b', 90, 25],
      ['c', 115, 50]
    ] as const) {
      doc = must(addClip(doc, { component: 'Shape', from, durationInFrames: length }, id));
    }
    return doc;
  }
  const span = (doc: MotionDoc, id: string) => {
    const c = findClip(doc, id)!.clip;
    return [c.from, c.from + c.durationInFrames];
  };

  it('starts the first clip on the nearest beat and ends every cut on a beat, back to back', () => {
    const beats = hitFrames(cuts(), analyses, Hit.Beats);
    const doc = must(cutToBeat(cuts(), ['c', 'a', 'b'], beats));

    expect([span(doc, 'a'), span(doc, 'b'), span(doc, 'c')]).toEqual([
      [45, 90],
      [90, 120],
      [120, 165]
    ]);
  });

  it('a clip never shrinks below one beat', () => {
    const tiny = must(addClip(scene(), { component: 'Shape', from: 60, durationInFrames: 3 }, 't'));
    const doc = must(cutToBeat(tiny, ['t'], hitFrames(tiny, analyses, Hit.Beats)));

    expect(span(doc, 't')).toEqual([60, 75]);
  });

  it('needs beats and clips', () => {
    expect(cutToBeat(cuts(), ['a'], []).ok).toBe(false);
    expect(cutToBeat(cuts(), [], [0, 15]).ok).toBe(false);
  });
});

describe('markHits', () => {
  it('adds a numbered marker on each beat, keeping the markers already there', () => {
    const doc = must(markHits({ ...scene(), markers: [{ frame: 0, label: 'intro' }] }, [45, 60], Hit.Beats));

    expect(doc.markers).toEqual([
      { frame: 0, label: 'intro' },
      { frame: 45, label: 'beat 1' },
      { frame: 60, label: 'beat 2' }
    ]);
  });

  it('marking again replaces the old beat markers instead of piling up', () => {
    const once = must(markHits(scene(), [45, 60], Hit.Beats));
    expect(must(markHits(once, [75], Hit.Beats)).markers).toEqual([{ frame: 75, label: 'beat 1' }]);
  });

  it('stops at the marker limit', () => {
    const many = Array.from({ length: 300 }, (_, i) => i);
    expect(must(markHits(scene(), many, Hit.Onsets)).markers).toHaveLength(MAX_MARKERS);
  });

  it('no hits, no markers', () => {
    expect(markHits(scene(), [], Hit.Beats).ok).toBe(false);
  });
});
