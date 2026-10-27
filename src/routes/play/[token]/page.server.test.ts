import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSharedPrototype = vi.fn();

vi.mock('$lib/server/canvas/prototype-share', () => ({
  readSharedPrototype: (...a: unknown[]) => readSharedPrototype(...a),
  sharedPrototypePorts: (db: unknown, isPublished: unknown) => ({ db, isPublished })
}));
vi.mock('$lib/server/canvas/canvas-share', () => ({ createShareReadDb: () => ({}) }));
vi.mock('$lib/server/motion/embed', () => ({ embedPublished: vi.fn() }));

const { load } = await import('./+page.server');

const call = (frame: string | null) =>
  load({ params: { token: 'tok' }, url: new URL(`https://app.test/play/tok${frame ? `?frame=${frame}` : ''}`), setHeaders: vi.fn() } as never);

beforeEach(() => vi.clearAllMocks());

describe('/play/[token]', () => {
  it('a revoked token or a canvas with nothing published is a 404', async () => {
    readSharedPrototype.mockResolvedValue(null);

    await expect(call(null)).rejects.toMatchObject({ status: 404 });
  });

  it('serves the prototype and starts on the frame in the link', async () => {
    const prototype = { canvasName: 'Launch', start: 'f2', frames: [] };
    readSharedPrototype.mockResolvedValue(prototype);

    expect(await call('f2')).toEqual({ prototype });
    expect(readSharedPrototype).toHaveBeenCalledWith(expect.anything(), 'tok', 'f2');
  });

  it('no frame in the link means the canvas picks the start', async () => {
    readSharedPrototype.mockResolvedValue({ canvasName: 'Launch', start: 'f1', frames: [] });

    await call(null);

    expect(readSharedPrototype).toHaveBeenCalledWith(expect.anything(), 'tok', null);
  });
});
