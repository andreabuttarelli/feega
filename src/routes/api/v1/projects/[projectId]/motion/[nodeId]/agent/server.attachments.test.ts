import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const world = vi.hoisted(() => ({ db: null as unknown, turns: [] as Record<string, unknown>[] }));

vi.mock('$lib/server/motion/agent-scope', () => ({
  motionAgentScope: async () => ({ db: world.db, user: { id: 'u-1' }, orgId: 'org-1', project: { id: 'p-1', brandId: null }, motion: { record: { id: 'n-1' } } })
}));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => null }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [{ id: 'anthropic/claude-sonnet-5.5', label: 'S', provider: 'anthropic', costTier: '$$$', inputUsdPerM: 2, outputUsdPerM: 10, efforts: ['medium'], defaultEffort: 'medium' }]
}));
vi.mock('$lib/server/motion/turn', () => ({
  Browser: { Attached: 'attached' },
  startMotionTurn: async (input: Record<string, unknown>) => {
    world.turns.push(input);
    return { stream: new ReadableStream({ start: (c) => c.close() }), done: Promise.resolve() };
  }
}));

const { POST } = await import('./+server');

const asset = { id: 'a-1', project_id: 'p-1', type: 'image', url: 'org-1/p-1/chat/u__logo.png', content: null, mime_type: 'image/png', bytes: 5, width: 1, height: 1, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09' };

function postEvent(body: Record<string, unknown>) {
  const request = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'anthropic/claude-sonnet-5.5', ...body }) });
  return { request, params: { projectId: 'p-1', nodeId: 'n-1' }, locals: {} } as unknown as Parameters<typeof POST>[0];
}

describe('the motion agent takes attachments', () => {
  beforeEach(() => {
    world.turns = [];
    world.db = fakeDb({ assets: [asset] }).db;
  });

  it('an attachment alone is a message, and reaches the turn as an asset of this project', async () => {
    const res = await POST(postEvent({ attachments: ['a-1'] }));

    expect(res.status).toBe(200);
    expect(world.turns[0]).toMatchObject({ message: '', attachments: [{ assetId: 'a-1', kind: 'image', name: 'logo.png' }] });
  });

  it('no text and no attachment is still an empty message', async () => {
    expect((await POST(postEvent({ message: ' ' }))).status).toBe(400);
  });

  it('more than ten attachments are refused', async () => {
    const res = await POST(postEvent({ message: 'hi', attachments: Array.from({ length: 11 }, (_, i) => `a-${i}`) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'too_many_attachments' });
    expect(world.turns).toEqual([]);
  });
});
