import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { setStill } from '$lib/motion/still';
import { ImageFormat, ImageScale, stillExport } from '$lib/motion/still-model';
import { drawStill, exportStill } from './still-export';
import type { StillPort, Viewport } from './server-frames';

const TOKENS = { name: 'feega', colors: {}, fonts: {} } as never;

function fakePort() {
  const opened: Viewport[] = [];
  const seeks: number[] = [];
  const pictures: { mime: string; quality?: number }[] = [];
  const port: StillPort = {
    open: async (viewport) => {
      opened.push(viewport);
      return {
        load: async () => {},
        seek: async (s) => {
          seeks.push(s);
        },
        jpeg: async () => Buffer.from('jpeg'),
        picture: async (mime, quality) => {
          pictures.push({ mime, quality });
          return Buffer.from('picture');
        },
        close: vi.fn(async () => {})
      };
    }
  };
  return { port, opened, seeks, pictures };
}

describe('exportStill', () => {
  it('a renderer that dies answers an error the caller can show, not a 500', async () => {
    vi.stubEnv('CHROMIUM_PATH', '/chrome');
    const port: StillPort = { open: async () => Promise.reject(new Error('Session closed')) };

    const made = await exportStill({} as never, { orgId: 'o', projectId: 'p', nodeId: 'n' }, newMotionDoc(MotionFormat.Square), stillExport(ImageFormat.Png, ImageScale.One), { tokens: TOKENS, assets: [] }, port);

    expect(made).toEqual({ ok: false, error: expect.stringContaining('Session closed') });
    vi.unstubAllEnvs();
  });
});

describe('drawStill', () => {
  it('draws the still frame at the full size of the doc times the scale, in the format asked', async () => {
    const pinned = setStill(newMotionDoc(MotionFormat.Portrait), 2);
    const doc = pinned.ok ? pinned.doc : newMotionDoc(MotionFormat.Portrait);
    const { port, opened, seeks, pictures } = fakePort();

    const bytes = await drawStill(port, { doc, tokens: TOKENS, assets: {} }, stillExport(ImageFormat.Png, ImageScale.Two));

    expect(bytes.toString()).toBe('picture');
    expect(opened).toEqual([{ width: 1080, height: 1350, scale: 2 }]);
    expect(seeks).toEqual([2]);
    expect(pictures).toEqual([{ mime: 'image/png', quality: undefined }]);
  });

  it('a video draws its first frame, a lossy format carries its quality', async () => {
    const { port, seeks, pictures } = fakePort();

    await drawStill(port, { doc: newMotionDoc(MotionFormat.Square), tokens: TOKENS, assets: {} }, stillExport(ImageFormat.Jpg, ImageScale.One));

    expect(seeks).toEqual([0]);
    expect(pictures[0]).toMatchObject({ mime: 'image/jpeg', quality: expect.any(Number) });
  });
});
