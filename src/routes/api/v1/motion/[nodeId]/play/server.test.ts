import { beforeEach, describe, expect, it, vi } from 'vitest';

const reachableCaller = vi.fn();
const sharePlay = vi.fn();

vi.mock('$lib/server/org-data/reach', () => ({ reachableCaller: (...a: unknown[]) => reachableCaller(...a) }));
vi.mock('$lib/server/app-url', () => ({ appOrigin: () => 'https://app.test' }));
vi.mock('$lib/server/motion/agent-play', () => ({ sharePlay: (...a: unknown[]) => sharePlay(...a) }));

const { POST } = await import('./+server');

const call = () => POST({ request: new Request('https://app.test/x', { method: 'POST' }), params: { nodeId: 'n1' }, url: new URL('https://app.test/x') } as never);

beforeEach(() => {
  vi.clearAllMocks();
  reachableCaller.mockResolvedValue({ db: {}, orgId: 'org-1', writeAllowed: true });
});

describe('POST /api/v1/motion/[nodeId]/play', () => {
  it('returns the play link with the frames and flows', async () => {
    const body = { url: 'https://app.test/play/t?frame=n1', frames: ['n1'], flows: [{ frame_id: 'n1', name: 'Onboarding' }] };
    sharePlay.mockResolvedValue({ ok: true, body });

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(sharePlay).toHaveBeenCalledWith({}, { orgId: 'org-1', nodeId: 'n1' }, 'https://app.test');
  });

  it('a read-only key cannot create a link', async () => {
    reachableCaller.mockResolvedValue({ db: {}, orgId: 'org-1', writeAllowed: false });

    expect((await call()).status).toBe(403);
    expect(sharePlay).not.toHaveBeenCalled();
  });

  it('a refused share carries its status', async () => {
    sharePlay.mockResolvedValue({ ok: false, failure: 'refused', body: { error: 'refused' } });

    expect((await call()).status).toBe(403);
  });
});
