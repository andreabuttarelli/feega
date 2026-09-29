import { describe, expect, it } from 'vitest';
import { thumbnailTransform, signThumbnailUrls } from './media-thumbnails';

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

    const signed = await signThumbnailUrls(() => bucket, ['a.png', 'b.png'], 60);

    expect(signed.get('a.png')).toBe('https://signed.example/a.png');
    expect(calls).toEqual([{ method: 'createSignedUrls', args: [['a.png', 'b.png'], 60] }]);
  });

  it('signs one path at a time with the preset transform, because the batch endpoint ignores it', async () => {
    const { bucket, calls } = fakeBucket();

    const signed = await signThumbnailUrls(() => bucket, ['a.png', 'b.png'], 60, 'pickerTile');

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

    const signed = await signThumbnailUrls(bucket, [], 60, 'pickerTile');

    expect(signed.size).toBe(0);
  });
});
