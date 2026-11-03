import { describe, expect, it } from 'vitest';
import { sourceReader } from './frame-sources';

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
