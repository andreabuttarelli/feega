import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MAX_FRAME_SIZE, drawFrames, firstFrames, type BrowserPort, type Viewport } from './server-frames';

type Log = { viewport?: Viewport; html?: string; seeks: number[]; closed: boolean };

function fakeBrowser(log: Log, failAt?: number): BrowserPort {
  return {
    open: async (viewport) => {
      log.viewport = viewport;
      return {
        load: async (html) => {
          log.html = html;
        },
        seek: async (seconds) => {
          if (seconds === failAt) {
            throw new Error('seek failed');
          }
          log.seeks.push(seconds);
        },
        jpeg: async () => Buffer.from(`frame ${log.seeks.at(-1)}`),
        close: async () => {
          log.closed = true;
        }
      };
    }
  };
}

const compose = { doc: newMotionDoc(MotionFormat.Landscape), tokens: FEEGA_TOKENS, assets: {} };
const fresh = (): Log => ({ seeks: [], closed: false });

describe('drawFrames', () => {
  it('seeks each time in order and returns one jpeg per time', async () => {
    const log = fresh();
    const frames = await drawFrames(fakeBrowser(log), { compose, times: [0.5, 2] });
    expect(log.seeks).toEqual([0.5, 2]);
    expect(frames.map((f) => [f.time, f.bytes.toString()])).toEqual([
      [0.5, 'frame 0.5'],
      [2, 'frame 2']
    ]);
    expect(log.html).toContain('<html');
    expect(log.closed).toBe(true);
  });

  it('lays the video out at full size and shrinks the shot to the asked size, never past the cap', async () => {
    const small = fresh();
    await drawFrames(fakeBrowser(small), { compose, times: [0], size: 480 });
    expect(small.viewport).toEqual({ width: 1920, height: 1080, scale: 0.25 });

    const capped = fresh();
    await drawFrames(fakeBrowser(capped), { compose, times: [0], size: 5000 });
    expect(capped.viewport).toEqual({ width: 1920, height: 1080, scale: MAX_FRAME_SIZE / 1920 });
  });

  it('closes the page even when a seek fails', async () => {
    const log = fresh();
    await expect(drawFrames(fakeBrowser(log, 1), { compose, times: [0, 1] })).rejects.toThrow('seek failed');
    expect(log.closed).toBe(true);
  });
});

describe('firstFrames', () => {
  const shot = (time: number) => [{ time, bytes: Buffer.from('x') }];

  it('takes the editor frames when the editor answers', async () => {
    let serverAsked = false;
    const server = async () => {
      serverAsked = true;
      return shot(2);
    };
    const frames = await firstFrames([async () => shot(1), server]);
    expect(frames?.[0].time).toBe(1);
    expect(serverAsked).toBe(false);
  });

  it('falls back to the server when the editor is gone or fails', async () => {
    expect((await firstFrames([async () => null, async () => shot(2)]))?.[0].time).toBe(2);
    expect((await firstFrames([() => Promise.reject(new Error('no editor')), async () => shot(3)]))?.[0].time).toBe(3);
  });

  it('is unavailable when nothing can draw', async () => {
    expect(await firstFrames([async () => null, () => Promise.reject(new Error('no chromium'))])).toBeNull();
  });
});
