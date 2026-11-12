import { beforeEach, describe, expect, it, vi } from 'vitest';

const cap = vi.fn();
const runMotionTool = vi.fn();
const runEditorOp = vi.fn();

vi.mock('$lib/server/agent-edits/cap', () => ({ agentEditCap: (...a: unknown[]) => cap(...a), AGENT_EDIT_CAP_STATUS: 402 }));
vi.mock('$lib/server/motion/tool-run', async (real) => ({ ...(await real<object>()), runMotionTool: (...a: unknown[]) => runMotionTool(...a) }));
vi.mock('$lib/server/frame-editor/editor-ops', async (real) => ({ ...(await real<object>()), runEditorOp: (...a: unknown[]) => runEditorOp(...a) }));
vi.mock('$lib/server/motion/editor-scope', () => ({ callerMotionScope: async () => ({ orgId: 'org', userId: 'u1' }) }));

const { runFrameTool, runEditorAction } = await import('./runners');
const { EDITOR_OPS, EditorAccess } = await import('$lib/server/frame-editor/editor-ops');

const caller = { db: {}, orgId: 'org', userId: 'u1', writeAllowed: true } as never;
const REFUSAL = { error: 'agent_edit_cap', used: 1000, limit: 1000, resets_at: '2026-11-14T00:00:00.000Z', upgrade_path: '/app/credits', message: 'm' };

beforeEach(() => {
  cap.mockReset().mockResolvedValue(REFUSAL);
  runMotionTool.mockReset();
  runEditorOp.mockReset();
});

describe('an agent at the free weekly cap', () => {
  it('gets a typed 402 from a frame tool, and nothing is written', async () => {
    expect(await runFrameTool(caller, { nodeId: 'n1', tool: 'set_text', input: {} })).toEqual({ status: 402, body: REFUSAL });
    expect(runMotionTool).not.toHaveBeenCalled();
  });

  it('gets the same refusal from an editor write', async () => {
    const write = Object.entries(EDITOR_OPS).find(([, op]) => op.access === EditorAccess.Write && op.input.safeParse({}).success);
    if (!write) {
      return;
    }

    expect(await runEditorAction(caller, { nodeId: 'n1', op: write[0] as never, input: {} })).toEqual({ status: 402, body: REFUSAL });
    expect(runEditorOp).not.toHaveBeenCalled();
  });
});
