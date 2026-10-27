import { describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({ refusal: null as string | null, started: vi.fn() }));

vi.mock('$lib/server/spend-caps/gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/spend-caps/gate')>()),
  liveCapReader: async () => ({}),
  capRefusal: async () => state.refusal
}));
vi.mock('$lib/server/project-agent/turn', () => ({ startProjectTurn: (...args: unknown[]) => state.started(...args) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [],
  resolveChoice: () => ({ ok: true, choice: { model: 'm', reasoning: null } })
}));
vi.mock('$lib/server/cli-auth', () => ({ gateAiAction: async () => null, gateOrgAiAction: async () => null }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()), listCanvases: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => ({ orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null } })
}));
vi.mock('$lib/server/repos/chat', () => ({ openThread: async () => 't', loadTurns: async () => [], promptHistory: () => [], saveTurn: async () => undefined }));

const { POST } = await import('./+server');

const ask = () => {
  const request = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }) });
  const locals = { safeGetSession: async () => ({ session: { access_token: 't' }, user: { id: 'u-1' } }), db: async () => ({}) };
  return POST({ request, url: new URL(request.url), params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0]);
};

describe('the project agent and spend caps', () => {
  it('a reached cap refuses the turn before it starts, with a typed error', async () => {
    state.refusal = 'cap_reached: your spending limit is reached.';

    const res = await ask();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'cap_reached', message: 'cap_reached: your spending limit is reached.' });
    expect(state.started).not.toHaveBeenCalled();
  });

  it('with room left the turn starts', async () => {
    state.refusal = null;
    state.started.mockResolvedValue(new Response('ok'));

    const res = await ask();

    expect(res.status).toBe(200);
    expect(state.started).toHaveBeenCalledTimes(1);
  });
});
