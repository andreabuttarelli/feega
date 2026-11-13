import { describe, expect, it } from 'vitest';
import { ItemKind, type DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { shrunk } from './frame-shot';

const page: DisplayList = { width: 1280, height: 2560, background: [1, 1, 1, 1], items: [{ kind: ItemKind.Path } as never], unsupported: [] };

describe('a frame drawn as its snapshot', () => {
  it('is the whole page scaled into the snapshot, on the page background', () => {
    const small = shrunk(page, { width: 320, height: 640, scale: 0.25 });

    expect([small.width, small.height, small.background]).toEqual([320, 640, [1, 1, 1, 1]]);
    expect(small.items).toHaveLength(1);
    expect(small.items[0]).toMatchObject({ kind: ItemKind.Group, matrix: [0.25, 0, 0, 0.25, 0, 0], items: page.items, opacity: 1 });
  });
});
