import { describe, expect, it } from 'vitest';
import { batchedSources, sourceReader } from './frame-sources';
import { frameCache, memoryShelf } from './frame-cache';
import { framesOnCanvas, frameSourceUrl } from './frame-source';
import { adoptFrameHead } from '$lib/canvas/node-save';

const answer = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe('reading a frame source once for the whole canvas', () => {
  it('fetches a revision once, however many parts of the canvas ask for it (an imported page was downloaded twice on open: once to draw, once to pick)', async () => {
    const asked: string[] = [];
    const read = sourceReader(async (url) => (asked.push(url), answer({ revision: 2, doc: { width: 1 } })));

    const [draw, pick] = await Promise.all([read('/s?revision=2'), read('/s?revision=2')]);
    const later = await read('/s?revision=2');

    expect(asked).toEqual(['/s?revision=2']);
    expect(draw).toEqual({ revision: 2, doc: { width: 1 } });
    expect(pick).toBe(draw);
    expect(later).toBe(draw);
  });

  it('lets go of a source the canvas sent back to its snapshot, so the doc can be collected', async () => {
    const asked: string[] = [];
    const read = sourceReader(async (url) => (asked.push(url), answer({ doc: {} })));

    await read('/s?revision=2');
    read.forget('/s?revision=2');
    await read('/s?revision=2');

    expect(asked).toEqual(['/s?revision=2', '/s?revision=2']);
  });

  it('fetches a new revision again', async () => {
    const asked: string[] = [];
    const read = sourceReader(async (url) => (asked.push(url), answer({ doc: {} })));

    await read('/s?revision=2');
    await read('/s?revision=3');

    expect(asked).toEqual(['/s?revision=2', '/s?revision=3']);
  });

  it('does not keep a failure, so the next ask tries again', async () => {
    let calls = 0;
    const read = sourceReader(async () => (calls++ === 0 ? answer(null, false) : answer({ doc: {} })));

    expect(await read('/s?revision=2')).toBeNull();
    expect(await read('/s?revision=2')).toEqual({ doc: {} });
  });

  it('reads a head not yet written (204) as no source, and asks again later', async () => {
    let calls = 0;
    const read = sourceReader(async () => (calls++ === 0 ? ({ ok: true, status: 204, json: async () => { throw new Error('empty'); } } as unknown as Response) : answer({ doc: {} })));

    expect(await read('/s?revision=2')).toBeNull();
    expect(await read('/s?revision=2')).toEqual({ doc: {} });
  });

  it('forgets the oldest sources past what it keeps', async () => {
    const asked: string[] = [];
    const read = sourceReader(async (url) => (asked.push(url), answer({ doc: {} })), 2);

    await read('/a');
    await read('/b');
    await read('/c');
    await read('/a');

    expect(asked).toEqual(['/a', '/b', '/c', '/a']);
  });
});

describe('reading the frames of a canvas in one request', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const url = (id: string) => `/p/p1/c/c1/motion/${id}/source?revision=3`;
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('asks once for every frame requested in the same tick, and adds the tokens to each', async () => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const read = batchedSources(async (u, init) => (asked.push({ url: u, init }), json({ tokens: { t: 1 }, frames: { [A]: { revision: 3, doc: { a: 1 }, assets: {} }, [B]: { revision: 3, doc: { b: 1 }, assets: {} } } })));

    const [a, b] = await Promise.all([read(url(A)), read(url(B))]);

    expect(asked.map((x) => x.url)).toEqual([`/p/p1/c/c1/motion/sources?ids=${A},${B}`]);
    expect(a).toEqual({ revision: 3, doc: { a: 1 }, assets: {}, addresses: {}, tokens: { t: 1 } });
    expect(b?.doc).toEqual({ b: 1 });
  });

  it('falls back to the single source for a frame the batch left out', async () => {
    const asked: string[] = [];
    const read = batchedSources(async (u) => (asked.push(u), u.includes('/sources?') ? json({ tokens: {}, frames: {} }) : json({ revision: 3, doc: {}, assets: {}, tokens: {} })));

    expect(await read(url(A))).toEqual({ revision: 3, doc: {}, assets: {}, tokens: {} });
    expect(asked).toEqual([`/p/p1/c/c1/motion/sources?ids=${A}`, url(A)]);
  });

  it('reads a url that is not a canvas frame source on its own', async () => {
    const asked: string[] = [];
    const read = batchedSources(async (u) => (asked.push(u), json({ doc: {} })));

    await read('/s?revision=2');

    expect(asked).toEqual(['/s?revision=2']);
  });
});

describe('warming the sources of every frame on open', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const url = (id: string) => `/p/p1/c/c1/motion/${id}/source?revision=1`;
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('asks for all the frames in one request, even when only a few are built at once (the canvas asked six at a time, one request each)', async () => {
    const asked: string[] = [];
    const read = batchedSources(async (u) => (asked.push(u), json({ tokens: {}, frames: Object.fromEntries(ids.map((id) => [id, { revision: 1, doc: { id }, assets: {} }])) })));

    read.warm(ids.map(url));
    for (const id of ids) {
      expect((await read(url(id)))?.doc).toEqual({ id });
    }

    expect(asked).toEqual([`/p/p1/c/c1/motion/sources?ids=${ids.join(',')}`]);
  });
});

describe('signed asset links beside the frames', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const P = '00000000-0000-4000-8000-0000000000f1';
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('draws with the signed link, and keeps the stable address beside it', async () => {
    const read = batchedSources(async () => json({ tokens: {}, signed: { [P]: 'https://signed/p' }, frames: { [A]: { revision: 3, doc: {}, assets: { [P]: `/p/p1/c/c1/assets/${P}` } } } }));

    const source = await read(`/p/p1/c/c1/motion/${A}/source?revision=3`);

    expect(source?.assets).toEqual({ [P]: 'https://signed/p' });
    expect(source?.addresses).toEqual({ [P]: `/p/p1/c/c1/assets/${P}` });
  });
});

describe('naming the org and the revisions held', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('passes the org and each revision on, so the server reads them beside the canvas check', async () => {
    const asked: string[] = [];
    const read = batchedSources(async (u) => (asked.push(u), json({ tokens: {}, frames: {} })));

    read.warm([`/p/p1/c/c1/motion/${A}/source?revision=3&org=o1`, `/p/p1/c/c1/motion/${B}/source?revision=5&org=o1`]);
    await new Promise((done) => setTimeout(done, 1));

    expect(asked[0]).toBe(`/p/p1/c/c1/motion/sources?ids=${A},${B}&at=3,5&org=o1`);
  });

  it('leaves them out when a frame does not say', async () => {
    const asked: string[] = [];
    const read = batchedSources(async (u) => (asked.push(u), json({ tokens: {}, frames: {} })));

    read.warm([`/p/p1/c/c1/motion/${A}/source?revision=3`, `/p/p1/c/c1/motion/${B}/source`]);
    await new Promise((done) => setTimeout(done, 1));

    expect(asked[0]).toBe(`/p/p1/c/c1/motion/sources?ids=${A},${B}`);
  });
});

describe('a frame kept from an earlier open is drawn only at the revision the canvas confirms', () => {
  const C = '00000000-0000-4000-8000-0000000000c1';
  const A = '00000000-0000-4000-8000-00000000000a';
  const urlAt = (revision: number, look = 'l1') => `/p/p1/c/${C}/motion/${A}/source?revision=${revision}&org=o1&look=${look}`;
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
  const doc = (revision: number, tag: string) => ({ revision, doc: { tag }, assets: {}, tokens: { t: 1 } });
  const frames = (revision: number, tag: string) => json({ tokens: { t: 1 }, frames: { [A]: { revision, doc: { tag }, assets: {} } } });

  it('draws a confirmed revision from the cache without the network', async () => {
    const cache = frameCache(memoryShelf());
    await cache.keep(`${C}/${A}@3@l1@`, doc(3, 'kept') as never);
    let asked = 0;
    const read = batchedSources(async () => (asked++, frames(3, 'net')), undefined, () => cache);

    expect((await read(urlAt(3)))?.doc).toEqual({ tag: 'kept' });
    expect(asked).toBe(0);
  });

  it('never draws a stale cached revision', async () => {
    const cache = frameCache(memoryShelf());
    await cache.keep(`${C}/${A}@3@l1@`, doc(3, 'old') as never);
    const read = batchedSources(async () => frames(4, 'new'), undefined, () => cache);

    expect((await read(urlAt(4)))?.doc).toEqual({ tag: 'new' });
    expect(await cache.take(`${C}/${A}@3@l1@`)).toBeNull();
    expect((await cache.take(`${C}/${A}@4@l1@`))?.doc).toEqual({ tag: 'new' });
  });

  it('never draws a frame cached under another brand look', async () => {
    const cache = frameCache(memoryShelf());
    await cache.keep(`${C}/${A}@3@l1@`, doc(3, 'old look') as never);
    const read = batchedSources(async () => frames(3, 'new look'), undefined, () => cache);

    expect((await read(urlAt(3, 'l2')))?.doc).toEqual({ tag: 'new look' });
  });

  it('a remote edit landing during load wins: an answer newer than asked is drawn, never kept under the asked revision', async () => {
    const cache = frameCache(memoryShelf());
    const read = batchedSources(async () => frames(5, 'remote'), undefined, () => cache);

    expect((await read(urlAt(4)))?.doc).toEqual({ tag: 'remote' });
    expect(await cache.take(`${C}/${A}@4@l1@`)).toBeNull();
  });

  it('an agent edit through the API moves the head over realtime, and the next read skips the cached revision', async () => {
    const cache = frameCache(memoryShelf());
    await cache.keep(`${C}/${A}@3@l1@`, doc(3, 'before agent') as never);
    const tiles = [{ id: A, type: 'motion', x: 0, y: 0, displayName: null, data: { docHeadRevision: 3 }, saved: { docHeadRevision: 3 }, version: 1 }];
    const moved = adoptFrameHead({ table: 'nodes', eventType: 'UPDATE', new: { id: A, data: { docHeadRevision: 4 }, version: 2, x: 0, y: 0, display_name: null, deleted_at: null } } as never, tiles as never, () => []);
    const [frame] = framesOnCanvas([{ id: A, kind: 'motion', x: 0, y: 0, w: 100, h: 100 }], () => (moved as typeof tiles)[0].data);
    const read = batchedSources(async () => frames(4, 'after agent'), undefined, () => cache);

    expect(frame.revision).toBe(4);
    expect((await read(frameSourceUrl(() => `/p/p1/c/${C}/motion/${A}/source`, frame, { orgId: 'o1', look: 'l1' })))?.doc).toEqual({ tag: 'after agent' });
  });

  it('keeps the stable addresses, never a signed link that expires', async () => {
    const cache = frameCache(memoryShelf());
    const P = '00000000-0000-4000-8000-0000000000f1';
    const read = batchedSources(async () => json({ tokens: {}, signed: { [P]: 'https://signed/p' }, frames: { [A]: { revision: 3, doc: {}, assets: { [P]: `/a/${P}` } } } }), undefined, () => cache);

    await read(urlAt(3));

    expect((await cache.take(`${C}/${A}@3@l1@`))?.assets).toEqual({ [P]: `/a/${P}` });
  });

  it('caches nothing without a signed-in scope or a look', async () => {
    const cache = frameCache(memoryShelf());
    const read = batchedSources(async () => frames(3, 'net'), undefined, () => null);
    const unlooked = batchedSources(async () => frames(3, 'net'), undefined, () => cache);

    await read(urlAt(3));
    await unlooked(`/p/p1/c/${C}/motion/${A}/source?revision=3&org=o1`);

    expect(await cache.take(`${C}/${A}@3@l1@`)).toBeNull();
    expect(await cache.take(`${C}/${A}@3@@`)).toBeNull();
  });
});
