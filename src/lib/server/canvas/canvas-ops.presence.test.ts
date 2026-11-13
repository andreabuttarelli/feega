import { describe, expect, it, vi } from 'vitest';
import { AgentKey } from '$lib/server/repos/actor';

const touched = vi.fn().mockResolvedValue(undefined);

vi.mock('./agent-cursor', async (real) => ({ ...(await real<object>()), showAgentAt: (...a: unknown[]) => touched(...a) }));

const { CANVAS_OPS, canvasCtx, runOp } = await import('./canvas-ops');

describe('runOp: a canvas op an agent runs shows where it works', () => {
  it('publishes the nodes it touched, as the agent session that ran it', async () => {
    vi.spyOn(CANVAS_OPS.move_node, 'run').mockResolvedValueOnce({ node: { id: 'n1' } });
    const ctx = canvasCtx({ db: {} as never, orgId: 'o', projectId: 'p', userId: 'u', agentKey: AgentKey.Mcp, sessionId: 's' });

    const out = await runOp(ctx, 'move_node', { nodeId: 'n1', x: 0, y: 0 });

    expect(out).toEqual({ node: { id: 'n1' } });
    expect(touched).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'o', userId: 'u', agentKey: 'mcp', sessionId: 's' }), ['n1'], 'move_node');
  });
});
