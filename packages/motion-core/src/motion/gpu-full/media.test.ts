import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemKind, type DisplayList, type Item } from './display-list';
import { createMedia } from './media';

class Bitmap {
  closed = false;
  constructor(
    readonly width: number,
    readonly height: number
  ) {}
  close() {
    this.closed = true;
  }
}

const image = (clip: string, src: string) => ({ kind: ItemKind.Image, clip, src, video: false, mediaTime: 0, size: { width: 10, height: 10 } }) as unknown as Item;
const list = (...items: Item[]): DisplayList => ({ width: 10, height: 10, background: null, items, unsupported: [] });

describe('decoded pictures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('closes the pictures of a frame sent back to its snapshot, but not one another frame still draws', async () => {
    vi.stubGlobal('ImageBitmap', Bitmap);
    vi.stubGlobal('fetch', async () => ({ ok: true, blob: async () => new Blob() }));
    vi.stubGlobal('createImageBitmap', async () => new Bitmap(10, 10));
    const media = createMedia();
    const gone = list(image('a', '/a.png'), image('shared', '/s.png'));
    const kept = list(image('k', '/s.png'));
    await media.ready(gone);
    await media.ready(kept);
    const [a, shared] = [media.pictures(gone.items[0] as never)!.source as Bitmap, media.pictures(kept.items[0] as never)!.source as Bitmap];

    media.release(gone, [kept]);

    expect(a.closed).toBe(true);
    expect(shared.closed).toBe(false);
    expect(media.pictures(gone.items[0] as never)).toBeNull();
    expect(media.pictures(kept.items[0] as never)).not.toBeNull();
  });
});
