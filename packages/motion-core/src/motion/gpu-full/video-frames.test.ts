import { describe, expect, it, vi } from 'vitest';
import { createVideoFrames, type Decoder, type Frame } from './video-frames';

const MB = 1024 * 1024;
const FRAME_SECONDS = 0.5;

const frameOf = (n: number): Frame => ({ image: { n } as never, width: 512, height: 512 });

function fakeDecoder(): Decoder & { calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    frameAt: async (t) => {
      calls.push(t);
      const index = Math.floor(t / FRAME_SECONDS);
      return { frame: frameOf(index), start: index * FRAME_SECONDS, duration: FRAME_SECONDS };
    },
    close: vi.fn()
  };
}

const options = (open: (src: string, width: number) => Promise<Decoder>) => ({ open, supported: true, budget: 64 * MB, pool: 2 });

describe('video frames', () => {
  it('decodes once for every time inside the same frame', async () => {
    const decoder = fakeDecoder();
    const frames = createVideoFrames(options(async () => decoder));

    await frames.at('a.mp4', 0.1, 512);
    await frames.at('a.mp4', 0.4, 512);

    expect(decoder.calls).toEqual([0.1]);
  });

  it('shares one decode between simultaneous requests for a frame', async () => {
    const decoder = fakeDecoder();
    const frames = createVideoFrames(options(async () => decoder));

    const [a, b] = await Promise.all([frames.at('a.mp4', 0.1, 512), frames.at('a.mp4', 0.2, 512)]);

    expect(decoder.calls).toHaveLength(1);
    expect(a).toBe(b);
  });

  it('answers null without opening anything when WebCodecs is missing', async () => {
    const open = vi.fn();
    const frames = createVideoFrames({ ...options(open), supported: false });

    expect(await frames.at('a.mp4', 0, 512)).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('gives up on a source that fails to open, and does not retry', async () => {
    const open = vi.fn().mockRejectedValue(new Error('unsupported codec'));
    const frames = createVideoFrames(options(open));

    expect(await frames.at('a.mp4', 0, 512)).toBeNull();
    expect(await frames.at('a.mp4', 1, 512)).toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('closes the least recently used decoder past the pool size', async () => {
    const decoders = new Map<string, ReturnType<typeof fakeDecoder>>();
    const frames = createVideoFrames(
      options(async (src) => {
        const d = fakeDecoder();
        decoders.set(src, d);
        return d;
      })
    );

    await frames.at('a.mp4', 0, 512);
    await frames.at('b.mp4', 0, 512);
    await frames.at('a.mp4', 5, 512);
    await frames.at('c.mp4', 0, 512);

    expect(decoders.get('b.mp4')!.close).toHaveBeenCalled();
    expect(decoders.get('a.mp4')!.close).not.toHaveBeenCalled();
  });

  it('reports the cached runs of a source in seconds', async () => {
    const frames = createVideoFrames(options(async () => fakeDecoder()));

    await frames.at('a.mp4', 0, 512);
    await frames.at('a.mp4', 0.5, 512);

    expect(frames.cached('a.mp4')).toEqual([{ from: 0, to: 1 }]);
  });

  it('keeps the memory in its budget', async () => {
    const frames = createVideoFrames({ ...options(async () => fakeDecoder()), budget: 2 * 512 * 512 * 4 });

    await Promise.all([0, 0.5, 1, 1.5].map((t) => frames.at('a.mp4', t, 512)));

    expect(frames.bytes()).toBeLessThanOrEqual(2 * 512 * 512 * 4);
  });
});
