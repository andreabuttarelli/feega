import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentActor, AgentKey } from '$lib/server/repos/actor';

const recordEvent = vi.fn();
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));
vi.mock('./presence', () => ({ announcePresence: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/server/repos/canvas-events', () => ({ recordEvent: (...a: unknown[]) => recordEvent(...a) }));

const { createOrgWriteTools } = await import('./write-tool');

const written = [{ id: 'n1', org_id: 'org-1', canvas_id: 'c1', type: 'text', data: { prompt: 'hi' }, version: 1 }];

function supabase() {
  const builder = () => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      filter: () => b,
      not: () => b,
      limit: () => b,
      select: () => b,
      abortSignal: () => Promise.resolve({ data: written, count: 1, error: null })
    });
    return b;
  };
  return { from: () => ({ select: builder, insert: builder, update: builder, delete: builder }) };
}

const tools = (actor?: ReturnType<typeof agentActor>) =>
  createOrgWriteTools({ authority: { kind: 'service', supabase: supabase() as never }, orgId: 'org-1', userId: 'u1', actor }) as unknown as Record<string, (input: unknown) => Promise<Record<string, unknown>>>;

beforeEach(() => {
  recordEvent.mockReset().mockResolvedValue({});
});

describe('a node an API key writes through org rows is recorded, so the weekly agent cap counts it', () => {
  it('an insert records node.create with the agent actor', async () => {
    const actor = agentActor('u1', AgentKey.ApiKey);

    const out = await tools(actor).insertRow({ table: 'nodes', values: { canvas_id: 'c1', type: 'text', data: { prompt: 'hi' } } });

    expect(out.error, JSON.stringify(out)).toBeUndefined();
    expect(recordEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'org-1', canvasId: 'c1', nodeId: 'n1', kind: 'node.create', actor }));
  });

  it('a person writing the same rows records nothing here', async () => {
    await tools(undefined).insertRow({ table: 'nodes', values: { canvas_id: 'c1', type: 'text', data: { prompt: 'hi' } } });

    expect(recordEvent).not.toHaveBeenCalled();
  });
});
