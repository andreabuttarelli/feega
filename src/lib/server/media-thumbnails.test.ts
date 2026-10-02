import { afterEach, describe, expect, it, vi } from 'vitest';
import { thumbnailTransform, signThumbnailUrls, forgetSignedUrls } from './media-thumbnails';

describe('thumbnailTransform', () => {
  it('sizes the picker tile at 2x the rendered 96px tile', () => {
    expect(thumbnailTransform('pickerTile')).toEqual({ width: 192, height: 192, resize: 'cover', quality: 70 });
  });

  it('sizes the media grid tile at 2x the rendered 180px tile', () => {
    expect(thumbnailTransform('mediaGrid')).toEqual({ width: 360, height: 360, resize: 'cover', quality: 70 });
  });

  it('sizes the node thumbnail at 2x the rendered 140px tile', () => {
    expect(thumbnailTransform('nodeThumbnail')).toEqual({ width: 280, height: 280, resize: 'cover', quality: 70 });
  });

  it('sizes the panel tile at 2x the rendered 96px tile', () => {
    expect(thumbnailTransform('panelTile')).toEqual({ width: 192, height: 192, resize: 'cover', quality: 70 });
  });

  it.each([
    ['canvas256', 256],
    ['canvas512', 512],
    ['canvas1024', 1024],
    ['canvas2048', 2048]
  ] as const)('fits the %s canvas tier inside %ipx without cropping', (preset, px) => {
    expect(thumbnailTransform(preset)).toEqual({ width: px, height: px, resize: 'contain', quality: 75 });
  });
});

function fakeBucket() {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    bucket: {
      createSignedUrl: async (path: string, ttl: number, options?: unknown) => {
        calls.push({ method: 'createSignedUrl', args: [path, ttl, options] });
        return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
      },
      createSignedUrls: async (paths: string[], ttl: number) => {
        calls.push({ method: 'createSignedUrls', args: [paths, ttl] });
        return { data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })), error: null };
      }
    }
  };
}

describe('signThumbnailUrls', () => {
  it('batches when no preset is given, without a transform', async () => {
    const { bucket, calls } = fakeBucket();

    const signed = await signThumbnailUrls({ name: 'batch', open: () => bucket }, ['a.png', 'b.png'], 60);

    expect(signed.get('a.png')).toBe('https://signed.example/a.png');
    expect(calls).toEqual([{ method: 'createSignedUrls', args: [['a.png', 'b.png'], 60] }]);
  });

  it('signs one path at a time with the preset transform, because the batch endpoint ignores it', async () => {
    const { bucket, calls } = fakeBucket();

    const signed = await signThumbnailUrls({ name: 'single', open: () => bucket }, ['a.png', 'b.png'], 60, 'pickerTile');

    expect(signed.get('a.png')).toBe('https://signed.example/a.png');
    expect(signed.get('b.png')).toBe('https://signed.example/b.png');
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.method === 'createSignedUrl')).toBe(true);
    expect(calls[0].args[2]).toEqual({ transform: { width: 192, height: 192, resize: 'cover', quality: 70 } });
  });

  it('returns an empty map for no paths, without ever building the bucket', async () => {
    const bucket = () => {
      throw new Error('bucket factory called with nothing to sign');
    };

    const signed = await signThumbnailUrls({ name: 'empty', open: bucket }, [], 60, 'pickerTile');

    expect(signed.size).toBe(0);
  });
});

describe('signThumbnailUrls: a file keeps one URL while it is fresh, so the browser cache can hold it', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function stampedBucket() {
    let minted = 0;
    const calls: string[] = [];
    return {
      calls,
      bucket: {
        createSignedUrl: async (path: string) => {
          calls.push(path);
          minted += 1;
          return { data: { signedUrl: `https://signed.example/${path}?token=${minted}` }, error: null };
        },
        createSignedUrls: async (paths: string[]) => {
          calls.push(...paths);
          minted += 1;
          return { data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}?token=${minted}` })), error: null };
        }
      }
    };
  }

  it('a second read of the same file returns the same URL without signing again', async () => {
    const { bucket, calls } = stampedBucket();
    const source = { name: 'memo-same', open: () => bucket };

    const first = await signThumbnailUrls(source, ['a.png'], 3600, 'canvas512');
    const second = await signThumbnailUrls(source, ['a.png'], 3600, 'canvas512');

    expect(second.get('a.png')).toBe(first.get('a.png'));
    expect(calls).toEqual(['a.png']);
  });

  it('signs only the files it has not signed yet', async () => {
    const { bucket, calls } = stampedBucket();
    const source = { name: 'memo-batch', open: () => bucket };

    await signThumbnailUrls(source, ['a.png'], 3600);
    await signThumbnailUrls(source, ['a.png', 'b.png'], 3600);

    expect(calls).toEqual(['a.png', 'b.png']);
  });

  it('re-signs once half the lifetime is gone, so a reused URL never expires on screen', async () => {
    vi.useFakeTimers();
    const { bucket } = stampedBucket();
    const source = { name: 'memo-expiry', open: () => bucket };

    const first = await signThumbnailUrls(source, ['a.png'], 3600);
    vi.advanceTimersByTime(1800 * 1000);
    const later = await signThumbnailUrls(source, ['a.png'], 3600);

    expect(later.get('a.png')).not.toBe(first.get('a.png'));
  });

  it('a different size of the same file is a different URL', async () => {
    const { bucket, calls } = stampedBucket();
    const source = { name: 'memo-size', open: () => bucket };

    await signThumbnailUrls(source, ['a.png'], 3600, 'canvas256');
    await signThumbnailUrls(source, ['a.png'], 3600, 'canvas1024');

    expect(calls).toEqual(['a.png', 'a.png']);
  });

  it('keeps reusing a canvas URL until half of its 24h lifetime is gone', async () => {
    vi.useFakeTimers();
    const { bucket, calls } = stampedBucket();
    const source = { name: 'memo-day', open: () => bucket };
    const day = 86_400;

    await signThumbnailUrls(source, ['a.png'], day);
    vi.advanceTimersByTime((day / 2 - 1) * 1000);
    await signThumbnailUrls(source, ['a.png'], day);
    vi.advanceTimersByTime(2 * 1000);
    await signThumbnailUrls(source, ['a.png'], day);

    expect(calls).toEqual(['a.png', 'a.png']);
  });

  it('a forgotten path is signed again, at every size, while others stay reused', async () => {
    const { bucket, calls } = stampedBucket();
    const source = { name: 'memo-forget', open: () => bucket };

    await signThumbnailUrls(source, ['a.png', 'b.png'], 3600);
    await signThumbnailUrls(source, ['a.png'], 3600, 'canvas256');
    forgetSignedUrls('memo-forget', 'a.png');
    await signThumbnailUrls(source, ['a.png', 'b.png'], 3600);
    await signThumbnailUrls(source, ['a.png'], 3600, 'canvas256');

    expect(calls).toEqual(['a.png', 'b.png', 'a.png', 'a.png', 'a.png']);
  });
});
