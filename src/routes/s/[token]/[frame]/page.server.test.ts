import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSharedFrame = vi.fn();

vi.mock('$lib/server/canvas/frame-share', () => ({ readSharedFrame: (...a: unknown[]) => readSharedFrame(...a) }));
vi.mock('$lib/server/canvas/canvas-share', () => ({ createShareReadDb: () => ({}) }));
vi.mock('$lib/server/motion/embed', () => ({ embedPublished: vi.fn() }));

import { load } from './+page.server';

const event = (token: string, frame: string) => ({ params: { token, frame }, setHeaders: vi.fn(), locals: {} }) as never;

beforeEach(() => vi.clearAllMocks());

describe('/s/[token]/[frame]', () => {
  it('a revoked token or unpublished frame is a 404', async () => {
    readSharedFrame.mockResolvedValue(null);

    await expect(load(event('nope', 'f1'))).rejects.toMatchObject({ status: 404 });
  });

  it('a live frame renders its embed url and swipe list', async () => {
    const frame = { canvasName: 'Launch', frameId: 'f1', title: 'Intro', frames: [{ id: 'f1', title: 'Intro' }] };
    readSharedFrame.mockResolvedValue(frame);

    await expect(load(event('tok', 'f1'))).resolves.toMatchObject({ frame, embedSrc: '/e/f1?fit=contain' });
    expect(readSharedFrame).toHaveBeenCalledWith(expect.anything(), 'tok', 'f1', expect.any(Function));
  });
});
