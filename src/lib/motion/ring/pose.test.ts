import { describe, expect, it } from 'vitest';
import { RING_NUMBERS, RING_NUMBER_KEYS } from './model';
import { ringAt, type RingBake, type RingRow } from './pose';

const row = (over: Partial<RingRow> = {}): RingRow => ({ ...(Object.fromEntries(RING_NUMBER_KEYS.map((k) => [k, RING_NUMBERS[k].fallback])) as RingRow), ...over });

const bake = (over: Partial<RingBake> = {}): RingBake => ({
  id: 'ring',
  from: 0,
  trim: 0,
  fps: 30,
  width: 1920,
  height: 1080,
  unit: 1080,
  count: 8,
  slices: 6,
  loopFrames: 240,
  turns: 1,
  direction: 1,
  doubleSided: true,
  content: { width: 1920, height: 1080 },
  rows: [row()],
  ...over
});

const angleOf = (spin: string) => Number(/rotateY\((-?[\d.]+)deg\)/.exec(spin)?.[1]);

describe('the ring pose', () => {
  it('loops perfectly: the last frame of a loop leads back to the first', () => {
    const b = bake();

    expect(ringAt(b, 240)).toEqual(ringAt(b, 0));
    expect(angleOf(ringAt(b, 120).spin)).toBeCloseTo(180);
  });

  it('is the same pose whenever the same frame is asked, in any order', () => {
    const b = bake({ rows: [row({ ringRadius: 0.5 }), row({ ringRadius: 0.7 })] });
    const forward = [0, 1, 37, 1].map((f) => ringAt(b, f));

    expect(forward[3]).toEqual(forward[1]);
    expect(ringAt(b, 37)).toEqual(forward[2]);
  });

  it('turns the other way when the direction flips', () => {
    expect(angleOf(ringAt(bake({ direction: -1 }), 60).spin)).toBeCloseTo(-90);
  });

  it('bends every card along the radius: its slices step around the cylinder', () => {
    const pose = ringAt(bake(), 0);
    const angles = pose.slices.slice(0, 6).map((s) => Number(/rotateY\(([\d.]+)deg\)/.exec(s.transform)?.[1]));
    const steps = angles.slice(1).map((a, i) => a - angles[i]);

    expect(pose.slices).toHaveLength(8 * 6);
    expect(new Set(steps.map((d) => d.toFixed(2))).size).toBe(1);
    expect(steps[0]).toBeGreaterThan(0);
    expect(pose.slices[0].transform).toContain(`translateZ(${0.6 * 1080}px)`);
  });

  it('reads slice offsets left to right across the card', () => {
    const offsets = ringAt(bake(), 0).slices.slice(0, 6).map((s) => s.offset);

    expect([...offsets].sort((a, b) => b - a)).toEqual(offsets);
  });

  it('dims and blurs the cards turned away from the camera', () => {
    const pose = ringAt(bake({ rows: [row({ tiltX: 0, tiltZ: 0, cameraHeight: 0, backOpacity: 0.3, backBlur: 4 })] }), 0);
    const front = pose.slices[0];
    const back = pose.slices[4 * 6];

    expect(front.opacity).toBe(1);
    expect(front.blur).toBe(0);
    expect(back.opacity).toBeCloseTo(0.3);
    expect(back.blur).toBeCloseTo(4);
  });

  it('follows keyframed values frame by frame', () => {
    const b = bake({ rows: [row({ tiltX: 0 }), row({ tiltX: 20 })] });

    expect(ringAt(b, 0).tilt).toContain('rotateX(0deg)');
    expect(ringAt(b, 1).tilt).toContain('rotateX(20deg)');
  });

  it('starts counting from the clip, and a trim starts it later', () => {
    expect(ringAt(bake({ from: 30 }), 90)).toEqual(ringAt(bake(), 60));
    expect(ringAt(bake({ trim: 10 }), 0)).toEqual(ringAt(bake(), 10));
  });
});
