import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, motionDocSchema, newMotionDoc } from '../doc';
import { audioPlan } from '../audio-plan';
import { Instrument, soundScoreSchema } from './score';
import { SOUND_TRACK, laySound } from './lay';

const score = soundScoreSchema.parse({ voices: [{ id: 'fx', instrument: Instrument.Hit }], events: [{ voice: 'fx', at: 1, duration: 0.5 }] });

describe('laySound', () => {
  it('keeps the score in the doc and its render on a sound track, mixed in the export', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const out = laySound(doc, { score, assetId: 'render-1' }, { clip: 'c1', track: 't1' });
    if (!out.ok) {
      throw new Error(out.error);
    }

    expect(out.doc.sound).toEqual({ score, assetId: 'render-1', clipId: 'c1' });
    expect(out.doc.tracks.find((t) => t.id === 't1')?.name).toBe(SOUND_TRACK);
    expect(findClip(out.doc, 'c1')?.clip).toMatchObject({ component: 'Audio', from: 0, durationInFrames: doc.durationInFrames, props: { assetId: 'render-1' } });
    expect(audioPlan(out.doc, { 'render-1': 'https://x/render-1.wav' })).toEqual([expect.objectContaining({ clipId: 'c1', url: 'https://x/render-1.wav', at: 0, duration: doc.durationInFrames / doc.fps })]);
    expect(motionDocSchema.safeParse(out.doc).success).toBe(true);
  });

  it('replaces the previous render instead of stacking a second one', () => {
    const first = laySound(newMotionDoc(MotionFormat.Square), { score, assetId: 'r1' }, { clip: 'c1', track: 't1' });
    const again = first.ok ? laySound(first.doc, { score, assetId: 'r2' }, { clip: 'c2', track: 't2' }) : first;
    if (!again.ok) {
      throw new Error(again.error);
    }

    expect(findClip(again.doc, 'c1')).toBeNull();
    expect(again.doc.tracks.filter((t) => t.name === SOUND_TRACK)).toHaveLength(1);
    expect(findClip(again.doc, 'c2')?.clip.props.assetId).toBe('r2');
  });
});
