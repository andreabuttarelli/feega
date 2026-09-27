import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSharedCanvas = vi.fn();

vi.mock('$lib/server/canvas/canvas-share', () => ({
  readSharedCanvas: (...a: unknown[]) => readSharedCanvas(...a),
  createShareReadDb: () => ({}),
  signSharedMedia: () => async () => new Map()
}));

import { load } from './+page.server';

const event = (token: string) => ({ params: { token }, setHeaders: vi.fn() }) as never;

beforeEach(() => vi.clearAllMocks());

describe('/s/[token]', () => {
  it('a revoked or unknown token is a 404', async () => {
    readSharedCanvas.mockResolvedValue(null);

    await expect(load(event('nope'))).rejects.toMatchObject({ status: 404 });
  });

  it('a live token renders its nodes', async () => {
    const shared = { name: 'Moodboard', nodes: [{ id: 'n1' }], edges: [] };
    readSharedCanvas.mockResolvedValue(shared);

    await expect(load(event('tok'))).resolves.toEqual({ shared });
    expect(readSharedCanvas).toHaveBeenCalledWith(expect.anything(), 'tok', expect.anything());
  });
});
