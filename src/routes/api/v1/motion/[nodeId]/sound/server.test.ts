import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ writeAllowed: true, calls: [] as unknown[] }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: {}, orgId: 'o', userId: 'u', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/motion/sound', () => ({
  writeSound: async (...args: unknown[]) => {
    state.calls.push(args);
    return { ok: true, version: 2 };
  }
}));

const { POST } = await import('./+server');

const call = (body: unknown) => {
  const url = new URL('https://feega.test/api/v1/motion/n1/sound');
  const request = new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
  return POST({ request, params: { nodeId: 'n1' }, url } as never);
};

describe('/api/v1/motion/[nodeId]/sound', () => {
  beforeEach(() => {
    state.writeAllowed = true;
    state.calls = [];
  });

  it('POST writes the score on the node for the caller', async () => {
    const res = await call({ voices: [], events: [] });

    expect(res.status).toBe(200);
    expect(state.calls[0]).toEqual([{}, { orgId: 'o', userId: 'u', nodeId: 'n1' }, { voices: [], events: [] }]);
  });

  it('a read-only key cannot write', async () => {
    state.writeAllowed = false;

    expect((await call({})).status).toBe(403);
    expect(state.calls).toEqual([]);
  });
});
