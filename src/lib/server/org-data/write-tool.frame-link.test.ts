import { describe, expect, it, vi } from 'vitest';
import { createOrgWriteTools } from './write-tool';

vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));
vi.mock('./presence', () => ({ announcePresence: vi.fn().mockResolvedValue(undefined) }));
const { linkFrame } = vi.hoisted(() => ({ linkFrame: vi.fn().mockResolvedValue({ outcome: 'done', frameId: 'f1', clipId: 'img', versions: { f1: 2 } }) }));
vi.mock('$lib/server/motion/move-element', async (real) => ({ ...(await real<object>()), linkFrame }));

function authority() {
  const builder = (rows: unknown[]) => {
    const b = { eq: () => b, is: () => b, select: () => b, maybeSingle: () => Promise.resolve({ data: null, error: null }), abortSignal: () => Promise.resolve({ data: rows, error: null }) };
    return b;
  };
  return {
    from: () => ({ select: () => builder([]), insert: (values: Record<string, unknown>) => builder([{ id: 'c1', ...values }]) })
  };
}

describe('insert_row on nodes_connections into a Frame', () => {
  it('links the source output into the frame, the same op the canvas uses', async () => {
    const tools = createOrgWriteTools({ authority: { kind: 'service', supabase: authority() as never }, orgId: 'org-mine' });

    const out = await tools.insertRow({ table: 'nodes_connections', values: { canvas_id: 'c1', source_node_id: 'gen', target_node_id: 'f1' } });

    expect('error' in out).toBe(false);
    expect(linkFrame).toHaveBeenCalledWith(expect.anything(), { sourceNodeId: 'gen', frameNodeId: 'f1' });
  });
});
