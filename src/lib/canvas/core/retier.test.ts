import { describe, expect, it } from 'vitest';
import { retiered, retiers } from './retier';

const image = (clip: string, src: string) => ({ kind: 'image', clip, src });
const list = (items: unknown[]) => ({ width: 10, height: 10, background: null, items }) as never;

describe('retiered list', () => {
  it('swaps each image to the new tier and keeps its clip, so only the texture changes', () => {
    const before = list([image('a', '/assets/1?size=256'), { kind: 'group', clip: 'g', items: [image('b', '/assets/2?size=256')] }]);
    const swap = new Map([['/assets/1?size=256', '/assets/1?size=1024'], ['/assets/2?size=256', '/assets/2?size=1024']]);

    const after = retiered(before, swap) as { items: { clip: string; src?: string; items?: { clip: string; src: string }[] }[] };

    expect(after.items[0]).toMatchObject({ clip: 'a', src: '/assets/1?size=1024' });
    expect(after.items[1].items?.[0]).toMatchObject({ clip: 'b', src: '/assets/2?size=1024' });
  });

  it('tells whether a swap reaches any image of the list', () => {
    const before = list([image('a', '/assets/1?size=256')]);

    expect(retiers(before, new Map([['/assets/1?size=256', '/assets/1?size=1024']]))).toBe(true);
    expect(retiers(before, new Map([['/other', '/x']]))).toBe(false);
  });

  it('leaves images it has no swap for untouched', () => {
    const before = list([image('a', 'https://elsewhere/x.png')]);

    expect(retiered(before, new Map())).toEqual(before);
  });
});
