import { describe, expect, it } from 'vitest';
import { cacheName, forgetFrameCaches, frameCache, memoryShelf, type CacheShelf } from './frame-cache';
import type { FrameDoc } from './frame-build';

const C1 = '00000000-0000-4000-8000-0000000000c1';
const C2 = '00000000-0000-4000-8000-0000000000c2';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

const source = (revision: number, size = 1) => ({ revision, doc: { pad: 'x'.repeat(size) }, assets: {}, tokens: {} }) as unknown as FrameDoc;

const shelves = () => {
  const named = new Map<string, CacheShelf>();
  return (name: string) => named.get(name) ?? named.set(name, memoryShelf()).get(name)!;
};

describe('the frame cache kept on this device', () => {
  it('two orgs never read each other entries, even for the same user on the same device', async () => {
    const open = shelves();
    const first = frameCache(open(cacheName({ userId: 'u1', orgId: 'o1' })));
    const second = frameCache(open(cacheName({ userId: 'u1', orgId: 'o2' })));
    const otherUser = frameCache(open(cacheName({ userId: 'u2', orgId: 'o1' })));

    await first.keep(`${C1}/${A}@3@look@`, source(3));

    expect(await first.take(`${C1}/${A}@3@look@`)).toEqual(source(3));
    expect(await second.take(`${C1}/${A}@3@look@`)).toBeNull();
    expect(await otherUser.take(`${C1}/${A}@3@look@`)).toBeNull();
  });

  it('keeps one revision per frame: a newer one replaces the older', async () => {
    const cache = frameCache(memoryShelf());

    await cache.keep(`${C1}/${A}@3@look@`, source(3));
    await cache.keep(`${C1}/${A}@4@look@`, source(4));

    expect(await cache.take(`${C1}/${A}@3@look@`)).toBeNull();
    expect(await cache.take(`${C1}/${A}@4@look@`)).toEqual(source(4));
  });

  it('evicts the least recently used frames past the entry cap', async () => {
    let clock = 0;
    const cache = frameCache(memoryShelf(), { entries: 2, bytes: Infinity }, () => ++clock);

    await cache.keep(`${C1}/${A}@1@l@`, source(1));
    await cache.keep(`${C1}/${B}@1@l@`, source(1));
    await cache.take(`${C1}/${A}@1@l@`);
    await cache.keep(`${C2}/${A}@1@l@`, source(1));

    expect(await cache.take(`${C1}/${B}@1@l@`)).toBeNull();
    expect(await cache.take(`${C1}/${A}@1@l@`)).not.toBeNull();
    expect(await cache.take(`${C2}/${A}@1@l@`)).not.toBeNull();
  });

  it('evicts past the size cap', async () => {
    let clock = 0;
    const cache = frameCache(memoryShelf(), { entries: Infinity, bytes: 3000 }, () => ++clock);

    await cache.keep(`${C1}/${A}@1@l@`, source(1, 2000));
    await cache.keep(`${C1}/${B}@1@l@`, source(1, 2000));

    expect(await cache.take(`${C1}/${A}@1@l@`)).toBeNull();
    expect(await cache.take(`${C1}/${B}@1@l@`)).not.toBeNull();
  });

  it('forgets a deleted canvas', async () => {
    const cache = frameCache(memoryShelf());

    await cache.keep(`${C1}/${A}@1@l@`, source(1));
    await cache.keep(`${C2}/${B}@1@l@`, source(1));
    await cache.forgetCanvas(C1);

    expect(await cache.take(`${C1}/${A}@1@l@`)).toBeNull();
    expect(await cache.take(`${C2}/${B}@1@l@`)).not.toBeNull();
  });

  it('logout deletes every frame cache and thumbnail store on the device, and nothing else', async () => {
    const deleted: string[] = [];
    const factory = {
      databases: async () => [{ name: cacheName({ userId: 'u1', orgId: 'o1' }) }, { name: 'feega-frame-thumbs:u2:o2' }, { name: 'feega-outbox' }],
      deleteDatabase: (name: string) => (deleted.push(name), {} as IDBOpenDBRequest)
    } as unknown as IDBFactory;

    await forgetFrameCaches(factory);

    expect(deleted.sort()).toEqual([cacheName({ userId: 'u1', orgId: 'o1' }), 'feega-frame-thumbs:u2:o2'].sort());
  });
});
