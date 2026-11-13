import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSharedSource = vi.fn();

vi.mock('$lib/server/canvas/canvas-share', () => ({ createShareReadDb: () => ({}) }));
vi.mock('$lib/server/canvas/frame-share', () => ({ readSharedSource: (...a: unknown[]) => readSharedSource(...a) }));

import { GET } from './+server';

const NODE = '0c2eaf85-00e6-4356-8754-7b6a01a9ed5d';
const call = (node: string) => GET({ params: { token: 'tok', node } } as never);

beforeEach(() => vi.clearAllMocks());

describe('GET /s/[token]/source/[node], anonymous', () => {
  it('answers with the frame source, no session needed', async () => {
    readSharedSource.mockResolvedValue({ revision: 3, doc: {}, assets: {}, tokens: {} });

    const res = await call(NODE);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revision: 3 });
    expect(readSharedSource).toHaveBeenCalledWith(expect.anything(), 'tok', NODE);
  });

  it('a node outside the shared canvas is a 404', async () => {
    readSharedSource.mockResolvedValue(null);

    await expect(call(NODE)).rejects.toMatchObject({ status: 404 });
  });

  it('a malformed id never reaches the database', async () => {
    await expect(call('../x')).rejects.toMatchObject({ status: 404 });
    expect(readSharedSource).not.toHaveBeenCalled();
  });

  it('exposes no write method', async () => {
    const route = await import('./+server');

    expect(Object.keys(route)).toEqual(['GET']);
  });
});
