import { describe, expect, it } from 'vitest';
import { createVideoFrames, type Frame } from './video-frames';
import { createRamPreview } from './ram-preview';
import type { VideoUse } from './media';

const FPS = 10;
const SIDE = 4;
const FRAME_BYTES = SIDE * SIDE * 4;

const frameOf = (): Frame => ({ image: {} as ImageBitmap, width: SIDE, height: SIDE });

function rig(budgetFrames = 100, usesOf: (frame: number) => VideoUse[] = (frame) => [{ src: 'a.mp4', time: frame / FPS, width: SIDE }]) {
  const decoded: number[] = [];
  const frames = createVideoFrames({
    supported: true,
    budget: budgetFrames * FRAME_BYTES,
    pool: 2,
    open: async () => ({
      frameAt: async (t) => {
        decoded.push(Math.round(t * FPS));
        const index = Math.round(t * FPS);
        return { frame: frameOf(), start: index / FPS, duration: 1 / FPS };
      },
      close: () => {}
    })
  });
  return { ram: createRamPreview({ frames, uses: usesOf }), decoded };
}

const never = new AbortController().signal;

describe('RAM preview', () => {
  it('decodes every video frame of the range once, in order', async () => {
    const { ram, decoded } = rig();

    await ram.fill({ from: 2, to: 6 }, never);

    expect(decoded).toEqual([2, 3, 4, 5]);
    expect(ram.runs({ from: 0, to: 10 })).toEqual([{ from: 2, to: 6 }]);
  });

  it('decodes only what is not cached yet', async () => {
    const { ram, decoded } = rig();
    await ram.fill({ from: 2, to: 4 }, never);
    decoded.length = 0;

    await ram.fill({ from: 0, to: 6 }, never);

    expect(decoded).toEqual([0, 1, 4, 5]);
    expect(ram.runs({ from: 0, to: 6 })).toEqual([{ from: 0, to: 6 }]);
  });

  it('stops when aborted, keeping what is done', async () => {
    const { ram, decoded } = rig();
    const abort = new AbortController();

    await ram.fill({ from: 0, to: 50 }, abort.signal, (done) => done === 3 && abort.abort());

    expect(decoded).toEqual([0, 1, 2]);
    expect(ram.runs({ from: 0, to: 50 })).toEqual([{ from: 0, to: 3 }]);
  });

  it('counts frames with no video as ready', async () => {
    const { ram } = rig(100, (frame) => (frame < 3 ? [] : [{ src: 'a.mp4', time: frame / FPS, width: SIDE }]));

    await ram.fill({ from: 0, to: 5 }, never);

    expect(ram.runs({ from: 0, to: 5 })).toEqual([{ from: 0, to: 5 }]);
  });

  it('is ready on a frame only when every video in it is cached', async () => {
    const { ram } = rig(100, (frame) => [
      { src: 'a.mp4', time: frame / FPS, width: SIDE },
      { src: 'b.mp4', time: frame / FPS, width: SIDE }
    ]);

    await ram.fill({ from: 0, to: 3 }, never);

    expect(ram.runs({ from: 0, to: 3 })).toEqual([{ from: 0, to: 3 }]);
  });

  it('shows the shortened run when the budget cannot hold the range', async () => {
    const { ram } = rig(4);

    await ram.fill({ from: 0, to: 10 }, never);

    expect(ram.runs({ from: 0, to: 10 })).toEqual([{ from: 6, to: 10 }]);
  });
});
