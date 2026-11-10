import { describe, expect, it } from 'vitest';
import { batchedSources, sourceReader } from './frame-sources';

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

describe('a frame kept from an earlier open', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const url = `/p/p1/c/c1/motion/${A}/source?revision=3`;
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
  const memory = () => {
    const kept = new Map<string, unknown>();
    return { kept, get: async (key: string) => (kept.get(key) ?? null) as never, put: (key: string, source: unknown) => void kept.set(key, source) };
  };

  it('draws from what was kept without waiting for the network, and keeps the fresh answer for next time', async () => {
    const store = memory();
    store.kept.set(`${A}@3`, { revision: 3, doc: { old: 1 }, assets: {}, tokens: {} });
    let answer: (r: Response) => void = () => undefined;
    const read = batchedSources(() => new Promise((r) => (answer = r)), undefined, store);

    const drawn = await read(url);
    await new Promise((r) => setTimeout(r, 0));
    answer(json({ tokens: { t: 2 }, frames: { [A]: { revision: 3, doc: { new: 1 }, assets: {} } } }));
    await new Promise((r) => setTimeout(r, 0));

    expect(drawn).toEqual({ revision: 3, doc: { old: 1 }, assets: {}, tokens: {} });
    expect(store.kept.get(`${A}@3`)).toEqual({ revision: 3, doc: { new: 1 }, assets: {}, tokens: { t: 2 } });
  });

  it('keeps the stable addresses, never a signed link that expires', async () => {
    const store = memory();
    const P = '00000000-0000-4000-8000-0000000000f1';
    const read = batchedSources(async () => json({ tokens: {}, signed: { [P]: 'https://signed/p' }, frames: { [A]: { revision: 3, doc: {}, assets: { [P]: `/a/${P}` } } } }), undefined, store);

    await read(url);

    expect((store.kept.get(`${A}@3`) as { assets: unknown }).assets).toEqual({ [P]: `/a/${P}` });
  });

  it('keeps what a first open fetched', async () => {
    const store = memory();
    const read = batchedSources(async () => json({ tokens: {}, frames: { [A]: { revision: 3, doc: { a: 1 }, assets: {} } } }), undefined, store);

    await read(url);

    expect(store.kept.get(`${A}@3`)).toEqual({ revision: 3, doc: { a: 1 }, assets: {}, tokens: {} });
  });
});
