import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { FRAME_POINTS, viewVideoFrames, type FramePorts } from './video-frames';

const jpeg = () => sharp({ create: { width: 64, height: 36, channels: 3, background: '#336699' } }).jpeg().toBuffer();

async function ports(over: Partial<FramePorts> = {}): Promise<FramePorts> {
  const picture = await jpeg();
  return {
    fetchImage: vi.fn(async (url: string) => ({ url, status: 200, ok: true, mime: 'image/jpeg', bytes: picture })),
    fetchVideo: vi.fn(async (url: string) => ({ url, status: 200, ok: true, mime: 'video/mp4', bytes: Buffer.from('mp4') })),
    stills: vi.fn(async () => [picture, picture, picture]),
    store: vi.fn(async () => undefined),
    screen: vi.fn(async () => ({ ok: true as const })),
    remove: vi.fn(async () => undefined),
    ...over
  };
}

describe('video frames', () => {
  it('shows the cover and the frames at a quarter, half and three quarters, stored under the call', async () => {
    const p = await ports();

    const seen = await viewVideoFrames({ video: 'https://cdn.example/v.mp4', cover: 'https://cdn.example/c.jpg' }, 'o/p/web-views/c1', p);

    expect(p.stills).toHaveBeenCalledWith(Buffer.from('mp4'), FRAME_POINTS);
    expect(seen.images.map((i) => ('path' in i ? i.path : i.error))).toEqual(['o/p/web-views/c1/cover.jpg', 'o/p/web-views/c1/25.jpg', 'o/p/web-views/c1/50.jpg', 'o/p/web-views/c1/75.jpg']);
    expect(seen.parts).toHaveLength(4);
  });

  it('without a video shows the cover alone', async () => {
    const p = await ports();

    const seen = await viewVideoFrames({ video: null, cover: 'https://cdn.example/c.jpg' }, 'x', p);

    expect(p.fetchVideo).not.toHaveBeenCalled();
    expect(seen.parts).toHaveLength(1);
  });

  it('a video that does not download keeps the cover and says why', async () => {
    const p = await ports({ fetchVideo: vi.fn(async (url: string) => ({ url, status: 403, ok: false, mime: 'text/html', bytes: Buffer.alloc(0) })) });

    const seen = await viewVideoFrames({ video: 'https://cdn.example/v.mp4', cover: 'https://cdn.example/c.jpg' }, 'x', p);

    expect(seen.parts).toHaveLength(1);
    expect(seen.images[1]).toEqual({ url: 'https://cdn.example/v.mp4', error: 'the video server answered 403' });
  });

  it('a frame the screen refuses is dropped and removed', async () => {
    const screen = vi.fn(async (path: string) => (path.endsWith('50.jpg') ? { ok: false as const, error: 'people' } : { ok: true as const }));
    const p = await ports({ screen });

    const seen = await viewVideoFrames({ video: 'https://cdn.example/v.mp4', cover: null }, 'x', p);

    expect(seen.parts).toHaveLength(2);
    expect(p.remove).toHaveBeenCalledWith('x/50.jpg');
  });
});
