import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { DEEP_QUOTE } from '$lib/motion/deep';

const world = vi.hoisted(() => ({ turns: 0 }));

vi.mock('$lib/server/motion/agent-scope', () => ({
  motionAgentScope: async () => ({ db: {}, user: { id: 'u-1' }, orgId: 'org-1', project: { id: 'p-1', brandId: null }, motion: { record: { id: 'n-1' }, node: { format: 'landscape' } } })
}));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => null }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [{ id: 'anthropic/claude-opus-5.5', label: 'Opus', provider: 'anthropic', costTier: '$$$$', inputUsdPerM: 5, outputUsdPerM: 25, efforts: ['low', 'medium', 'high'], defaultEffort: 'medium' }]
}));
vi.mock('$lib/server/openrouter-models', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/openrouter-models')>()),
  ensureGatewayModels: async () => {},
  gatewayRate: () => ({ input: 5, cachedInput: 0.5, output: 25 })
}));
vi.mock('$lib/server/motion/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/editor')>()),
  headOrNew: async () => ({ version: 0, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'system' })
}));
vi.mock('$lib/server/motion/turn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/turn')>()),
  startMotionTurn: async () => {
    world.turns++;
    return new Response('quick turn');
  }
}));

const { POST } = await import('./+server');

const DUB = "make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are. it should be a launch saas video for https://dub.co";

function postEvent(body: Record<string, unknown>) {
  const request = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { request, params: { projectId: 'p-1', nodeId: 'n-1' }, locals: {} } as unknown as Parameters<typeof POST>[0];
}

describe('the motion agent sends a new video to a Deep job', () => {
  beforeEach(() => {
    world.turns = 0;
  });

  it('answers a request to create a video with a Deep quote to confirm, not a quick turn', async () => {
    const res = await POST(postEvent({ message: DUB, model: 'anthropic/claude-opus-5.5' }));
    const body = await res.text();

    expect(world.turns).toBe(0);
    expect(body).toContain(DEEP_QUOTE);
    expect(body).toMatch(/"credits":\d+/);
    expect(body).toContain('"model":"anthropic/claude-opus-5.5"');
  });

  it('keeps a small edit in the quick chat', async () => {
    await POST(postEvent({ message: 'make the title bigger', model: 'anthropic/claude-opus-5.5' }));

    expect(world.turns).toBe(1);
  });

  it('runs the quick chat when the user asks for it', async () => {
    await POST(postEvent({ message: DUB, model: 'anthropic/claude-opus-5.5', mode: 'quick' }));

    expect(world.turns).toBe(1);
  });
});
