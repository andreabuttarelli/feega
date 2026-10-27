import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { blobPose, blobRows, blobStrains, type BlobClip } from './pose';
import { ROW, ROW_LENGTH } from './shape';

const frame = { width: 1920, height: 1080, fps: 30 };
const same = (v: string) => v;

function gliding(props: Record<string, unknown> = {}): BlobClip {
  return {
    props: { diameter: 0.3, ...props },
    durationInFrames: 60,
    keyframes: {
      centerX: [
        { frame: 0, value: 0.2, ease: Ease.Linear },
        { frame: 20, value: 0.8, ease: Ease.Linear }
      ]
    }
  };
}

describe('blob pose', () => {
  it('stretches along the way it moves and narrows across it', () => {
    const clip = gliding();
    const strains = blobStrains(clip, frame);
    const moving = blobPose(clip, 15, strains[15], frame, same);

    expect(moving.unwarp.xx).toBeLessThan(1);
    expect(moving.unwarp.yy).toBeGreaterThan(1);
  });

  it('squashes and jiggles after it stops, then settles round', () => {
    const strains = blobStrains(gliding(), frame).map((s) => s.p);

    expect(Math.min(...strains.slice(20, 40))).toBeLessThan(0);
    expect(Math.abs(strains[60])).toBeLessThan(0.01);
  });

  it('keeps still when asked not to stretch', () => {
    const strains = blobStrains(gliding({ stretch: 0 }), frame);

    expect(strains.every((s) => s.p === 0 && s.q === 0)).toBe(true);
  });

  it('bakes one row per frame, the same on every bake', () => {
    const rows = blobRows(gliding({ drops: 2, split: 0.2, tint: '#ff0000' }), frame, same);

    expect(rows).toHaveLength(61);
    expect(rows.every((r) => r.length === ROW_LENGTH)).toBe(true);
    expect(rows[30].slice(ROW.tint, ROW.tint + 3)).toEqual([1, 0, 0]);
    expect(rows[30][ROW.drops + 5]).toBeGreaterThan(0);
    expect(rows[30][ROW.drops + 8]).toBe(0);
    expect(blobRows(gliding(), frame, same)).toEqual(blobRows(gliding(), frame, same));
  });

  it('keeps the box around the drops and their shadow', () => {
    const pose = blobPose(gliding(), 40, { p: 0, q: 0 }, frame, same);
    const r = pose.drops[0].r;

    expect(pose.box.x).toBeLessThan(pose.center.x - r);
    expect(pose.box.x + pose.box.width).toBeGreaterThan(pose.center.x + r);
  });
});
