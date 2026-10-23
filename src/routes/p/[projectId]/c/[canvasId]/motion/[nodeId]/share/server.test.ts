import { beforeEach, describe, expect, it, vi } from 'vitest';

const frameLink = vi.fn();

vi.mock('$lib/server/motion/editor-scope', () => ({ motionScope: async () => ({ db: {}, orgId: 'org-1', motion: { record: { id: 'n1' } } }) }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://app.test' }));
vi.mock('$lib/server/motion/agent-share', () => ({ frameLink: (...a: unknown[]) => frameLink(...a) }));

const { POST } = await import('./+server');

const call = () => POST({ locals: {}, params: {}, url: new URL('https://app.test/x') } as never);

beforeEach(() => vi.clearAllMocks());

describe('POST /p/[projectId]/c/[canvasId]/motion/[nodeId]/share', () => {
  it('links the frame already published from the editor, without rebuilding it', async () => {
    frameLink.mockResolvedValue({ ok: true, body: { url: 'https://app.test/s/t/n1', embed_url: 'https://app.test/e/n1' } });

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://app.test/s/t/n1', embed_url: 'https://app.test/e/n1' });
    expect(frameLink).toHaveBeenCalledWith({}, { orgId: 'org-1', nodeId: 'n1' }, 'https://app.test');
  });

  it('an unpublished frame has no link yet', async () => {
    frameLink.mockResolvedValue({ ok: false, failure: 'embed_not_published', body: { error: 'embed_not_published' } });

    expect((await call()).status).toBe(409);
  });
});
