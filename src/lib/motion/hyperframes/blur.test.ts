import { describe, expect, it } from 'vitest';
import { installEngine, testTimeline } from '../engine/testing';
import { DEFAULT_MOTION_BLUR, sampleTimes } from '../motion-blur';
import { holdStill } from './blur';

const blur = { ...DEFAULT_MOTION_BLUR, enabled: true };
const FPS = 30;

function scene() {
  const sharp = { x: 0, held: true };
  const blurred = { x: 0, held: false };
  const engine = installEngine();
  const tl = testTimeline(engine);
  tl.fromTo(sharp, { x: 0 }, { x: 300, duration: 1, ease: 'none' }, 0.5);
  tl.fromTo(blurred, { x: 0 }, { x: 300, duration: 1, ease: 'none' }, 0.5);
  holdStill(tl as never, ((t: { held?: boolean }) => Boolean(t.held)) as never, FPS, blur, engine as never);
  return { tl, sharp, blurred };
}

describe('a clip with motion blur off', () => {
  it('stays on its frame for every sample of the shutter, while a blurred clip moves between them', () => {
    const { tl, sharp, blurred } = scene();
    const frame = 30;
    const sharpXs = new Set<number>();
    const blurredXs = new Set<number>();

    for (const t of sampleTimes(frame, FPS, blur)) {
      tl.totalTime(t, true);
      sharpXs.add(Math.round(sharp.x * 1000));
      blurredXs.add(Math.round(blurred.x * 1000));
    }

    expect(sharpXs.size).toBe(1);
    expect(blurredXs.size).toBe(8);
  });

  it('on a frame boundary it shows exactly that frame, as it would without blur', () => {
    const { tl, sharp, blurred } = scene();

    tl.totalTime(30 / FPS, true);

    expect(sharp.x).toBeCloseTo(blurred.x);
    expect(sharp.x).toBeCloseTo(150);
  });

  it('holding is deterministic across seeks back and forth', () => {
    const { tl, sharp } = scene();
    tl.totalTime(40 / FPS, true);
    const first = sharp.x;
    tl.totalTime(0, true);
    tl.totalTime(40 / FPS, true);

    expect(sharp.x).toBe(first);
  });
});

describe('a held clip whose tween names no ease', () => {
  it('lands on the frame the engine default puts it on', () => {
    const engine = installEngine();
    const tl = testTimeline(engine);
    const sharp = { x: 0, held: true };
    tl.fromTo(sharp, { x: 0 }, { x: 300, duration: 1 }, 0);
    holdStill(tl as never, ((t: { held?: boolean }) => Boolean(t.held)) as never, FPS, blur, engine as never);

    tl.totalTime(9 / FPS, true);

    expect(sharp.x).toBeCloseTo(300 * engine.parseEase(undefined)(9 / FPS));
  });
});
