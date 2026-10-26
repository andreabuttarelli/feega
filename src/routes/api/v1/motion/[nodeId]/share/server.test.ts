import { beforeEach, describe, expect, it, vi } from 'vitest';

const reachableCaller = vi.fn();
const shareMotionFrame = vi.fn();

vi.mock('$lib/server/org-data/reach', () => ({ reachableCaller: (...a: unknown[]) => reachableCaller(...a) }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://app.test' }));
vi.mock('$lib/server/motion/agent-share', () => ({ shareMotionFrame: (...a: unknown[]) => shareMotionFrame(...a) }));

const { POST } = await import('./+server');

const call = () => POST({ request: new Request('https://app.test/x', { method: 'POST' }), params: { nodeId: 'n1' }, url: new URL('https://app.test/x') } as never);

beforeEach(() => {
  vi.clearAllMocks();
  reachableCaller.mockResolvedValue({ db: {}, orgId: 'org-1', writeAllowed: true });
});

describe('POST /api/v1/motion/[nodeId]/share', () => {
  it('returns the frame link', async () => {
    shareMotionFrame.mockResolvedValue({ ok: true, body: { url: 'https://app.test/s/t/n1', embed_url: 'https://app.test/e/n1' } });

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://app.test/s/t/n1', embed_url: 'https://app.test/e/n1' });
    expect(shareMotionFrame).toHaveBeenCalledWith({}, { orgId: 'org-1', nodeId: 'n1' }, 'https://app.test');
  });

  it('a read-only key cannot create a link', async () => {
    reachableCaller.mockResolvedValue({ db: {}, orgId: 'org-1', writeAllowed: false });

    expect((await call()).status).toBe(403);
    expect(shareMotionFrame).not.toHaveBeenCalled();
  });

  it('a refused share carries its status', async () => {
    shareMotionFrame.mockResolvedValue({ ok: false, failure: 'refused', body: { error: 'refused', refusal: 'uncensored_not_shareable' } });

    expect((await call()).status).toBe(403);
  });

  it('an unauthenticated caller gets the reach answer', async () => {
    reachableCaller.mockResolvedValue(new Response('{}', { status: 401 }));

    expect((await call()).status).toBe(401);
  });
});
