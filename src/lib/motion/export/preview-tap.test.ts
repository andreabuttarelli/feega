import { describe, expect, it } from 'vitest';
import type { FrameSource } from './browser-render';
import { tapFrames } from './preview-tap';

const SIZE = { width: 2, height: 2 };
const fake = (n: number) => ({ id: n }) as unknown as ImageBitmap;
const idOf = (b: ImageBitmap) => (b as unknown as { id: number }).id;
const live = () => new AbortController().signal;

const counting: FrameSource = async (times, _size, onFrame) => {
  for (let i = 0; i < times.length; i++) {
    await onFrame(fake(i), i);
  }
};

describe('tapFrames', () => {
  it('shows a frame before the encoder gets it, then forwards it untouched', async () => {
    const order: string[] = [];
    const tapped = tapFrames(counting, (b) => order.push(`show ${idOf(b)}`), { everyMs: 0, now: () => 0 });

    await tapped([0, 1], SIZE, async (b, i) => {
      order.push(`encode ${idOf(b)}@${i}`);
    }, live());

    expect(order).toEqual(['show 0', 'encode 0@0', 'show 1', 'encode 1@1']);
  });

  it('shows at most one frame per interval', async () => {
    let clock = 0;
    const shown: number[] = [];
    const tapped = tapFrames(counting, () => shown.push(clock), { everyMs: 100, now: () => clock });

    await tapped([0, 1, 2, 3], SIZE, async () => {
      clock += 60;
    }, live());

    expect(shown).toEqual([0, 120]);
  });
});
