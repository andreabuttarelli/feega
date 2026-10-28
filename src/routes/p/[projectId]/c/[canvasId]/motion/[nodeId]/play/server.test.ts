import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharePlay = vi.fn();

vi.mock('$lib/server/motion/editor-scope', () => ({ motionScope: async () => ({ db: {}, orgId: 'org-1', motion: { record: { id: 'n1' } } }) }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://app.test' }));
vi.mock('$lib/server/motion/agent-play', () => ({ sharePlay: (...a: unknown[]) => sharePlay(...a) }));

const { POST } = await import('./+server');

const call = () => POST({ locals: {}, params: {}, url: new URL('https://app.test/x') } as never);

beforeEach(() => vi.clearAllMocks());

describe('POST /p/[projectId]/c/[canvasId]/motion/[nodeId]/play', () => {
  it('shares the prototype from the editor', async () => {
    sharePlay.mockResolvedValue({ ok: true, body: { url: 'https://app.test/play/t?frame=n1' } });

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://app.test/play/t?frame=n1' });
    expect(sharePlay).toHaveBeenCalledWith({}, { orgId: 'org-1', nodeId: 'n1' }, 'https://app.test');
  });

  it('a frame that cannot be published has no link', async () => {
    sharePlay.mockResolvedValue({ ok: false, failure: 'nothing_to_publish', body: { error: 'nothing_to_publish' } });

    expect((await call()).status).toBe(409);
  });
});
