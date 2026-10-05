import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, addTrack, type OpResult } from './timeline';
import { TrackKind } from './components';
import { duckUnder, voicesOver } from './duck';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function scene(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Vertical);
  const music = must(
    addClip(
      base,
      {
        component: 'Audio',
        from: 0,
        durationInFrames: 300,
        props: { assetId: 'm', volume: 0.8 }
      },
      'music'
    )
  );
  const second = must(addTrack(music, TrackKind.Audio, 'vo-track'));
  return must(
    addClip(
      second,
      {
        component: 'Audio',
        from: 60,
        durationInFrames: 120,
        trackId: 'vo-track',
        props: { assetId: 'v' }
      },
      'vo'
    )
  );
}

const volume = (doc: MotionDoc) => findClip(doc, 'music')?.clip.keyframes.volume?.map((k) => [k.frame, k.value]);

describe('duckUnder', () => {
  it('without speech regions, ducks the music under the whole voice-over clip', () => {
    const doc = must(duckUnder(scene(), 'music', 'vo', null));

    expect(volume(doc)).toEqual([
      [0, 0.8],
      [54, 0.8],
      [60, 0.2],
      [180, 0.2],
      [192, 0.8]
    ]);
  });

  it('follows speech regions, measured in the voice file, through the clip trim', () => {
    const doc = must(
      duckUnder(scene(), 'music', 'vo', [
        { start: 0.5, end: 1.5 },
        { start: 3, end: 3.5 }
      ])
    );

    expect(volume(doc)).toEqual([
      [0, 0.8],
      [69, 0.8],
      [75, 0.2],
      [105, 0.2],
      [117, 0.8],
      [144, 0.8],
      [150, 0.2],
      [165, 0.2],
      [177, 0.8]
    ]);
  });

  it('pauses shorter than the attack and release stay ducked', () => {
    const doc = must(
      duckUnder(scene(), 'music', 'vo', [
        { start: 0, end: 1 },
        { start: 1.3, end: 2 }
      ])
    );

    expect(volume(doc)).toEqual([
      [0, 0.8],
      [54, 0.8],
      [60, 0.2],
      [120, 0.2],
      [132, 0.8]
    ]);
  });

  it('depth sets how far the music drops', () => {
    const doc = must(duckUnder(scene(), 'music', 'vo', null, { depth: 0.5 }));

    expect(volume(doc)?.[2]).toEqual([60, 0.4]);
  });

  it('options left unset keep their defaults', () => {
    const doc = must(
      duckUnder(scene(), 'music', 'vo', null, {
        depth: undefined,
        attack: undefined
      })
    );

    expect(volume(doc)?.slice(1, 3)).toEqual([
      [54, 0.8],
      [60, 0.2]
    ]);
  });

  it('refuses a voice that is not an audio clip, or no speech at all', () => {
    expect(duckUnder(scene(), 'music', 'nope', null).ok).toBe(false);
    expect(duckUnder(scene(), 'music', 'vo', []).ok).toBe(false);
  });
});

describe('voicesOver', () => {
  it('offers the audio clips on other tracks that overlap the music', () => {
    const doc = scene();
    const far = must(
      addClip(
        doc,
        {
          component: 'Audio',
          from: 600,
          durationInFrames: 30,
          trackId: 'vo-track',
          props: { assetId: 'v' }
        },
        'late'
      )
    );

    expect(voicesOver(far, 'music')).toEqual(['vo']);
    expect(voicesOver(far, 'vo')).toEqual(['music']);
  });
});
