import { describe, it, expect, vi } from 'vitest';

const spent = vi.hoisted(() => ({ screened: 0 }));

vi.mock('$lib/server/motion/agent-scope', () => ({
  motionAgentScope: async () => ({ db: {}, user: { id: 'u-1' }, orgId: 'org-1', project: { id: 'p-1', brandId: null }, motion: { record: { id: 'n-1' } } })
}));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => null }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [
    { id: 'anthropic/claude-sonnet-5.5', label: 'S', provider: 'anthropic', costTier: '$$$', inputUsdPerM: 2, outputUsdPerM: 10, efforts: ['medium'], defaultEffort: 'medium' }
  ]
}));
vi.mock('$lib/server/moderation/model-input', () => ({
  screenModelInput: async () => {
    spent.screened++;
    return { ok: true };
  }
}));

const { POST } = await import('./+server');

function postEvent(body: Record<string, unknown>) {
  const request = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi', ...body }) });
  return { request, params: { projectId: 'p-1', nodeId: 'n-1' }, locals: {} } as unknown as Parameters<typeof POST>[0];
}

describe('the motion agent validates the chosen model', () => {
  it('refuses a model outside the catalogue before any work', async () => {
    const res = await POST(postEvent({ model: 'evil/expensive' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown_model' });
    expect(spent.screened).toBe(0);
  });

  it('refuses an effort the model does not declare', async () => {
    const res = await POST(postEvent({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'max' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported_reasoning' });
  });
});
