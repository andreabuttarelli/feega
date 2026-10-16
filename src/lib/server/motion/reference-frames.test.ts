import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { parseBreakdown } from '$lib/video-reference';
import { MAX_REFERENCE_FRAMES, keyTimes, referenceFrames, sceneScores, similarity } from './reference-frames';

const breakdown = parseBreakdown(
  JSON.stringify({
    durationS: 10,
    scenes: [
      { start: 0, end: 2.6 },
      { start: 2.6, end: 10 }
    ],
    pacing: { cutsPerMinute: 12, rhythm: 'fast' }
  })
)!;

const solid = (hex: string) => sharp({ create: { width: 64, height: 36, channels: 3, background: hex } }).png().toBuffer();

describe('reference keyframes', () => {
  it('samples each scene at its start, middle and end, inside the scene', () => {
    expect(keyTimes(breakdown)).toEqual([
      { scene: 1, time: 0.2 },
      { scene: 1, time: 1.3 },
      { scene: 1, time: 2.4 },
      { scene: 2, time: 2.8 },
      { scene: 2, time: 6.3 },
      { scene: 2, time: 9.8 }
    ]);
  });

  it('a long reference is capped, keeping every scene', () => {
    const many = parseBreakdown(JSON.stringify({ durationS: 30, scenes: Array.from({ length: 10 }, (_, i) => ({ start: i * 3, end: i * 3 + 3 })), pacing: { cutsPerMinute: 20, rhythm: '' } }))!;
    const times = keyTimes(many);

    expect(times.length).toBeLessThanOrEqual(MAX_REFERENCE_FRAMES);
    expect(new Set(times.map((t) => t.scene)).size).toBe(10);
  });

  it('grabs one picture per key time and drops the ones that fail', async () => {
    const red = await solid('#c80010');
    const frames = await referenceFrames(async (t) => (t > 5 ? null : red), keyTimes(breakdown));

    expect(frames.map((f) => f.time)).toEqual([0.2, 1.3, 2.4, 2.8]);
  });
});

describe('similarity to the reference', () => {
  it('the same picture scores 1, black against white scores 0', async () => {
    expect(await similarity(await solid('#ff6a00'), await solid('#ff6a00'))).toBeCloseTo(1);
    expect(await similarity(await solid('#000000'), await solid('#ffffff'))).toBeCloseTo(0);
  });

  it('the red scene rendered black scores low (live test: Cautiva red scene came out black)', async () => {
    expect(await similarity(await solid('#c80010'), await solid('#000000'))).toBeLessThan(0.8);
  });

  it('scores average per scene', () => {
    expect(
      sceneScores([
        { scene: 1, time: 0.2, score: 0.9 },
        { scene: 1, time: 1.3, score: 0.7 },
        { scene: 2, time: 3, score: 0.5 }
      ])
    ).toEqual([
      { scene: 1, score: 0.8 },
      { scene: 2, score: 0.5 }
    ]);
  });
});
