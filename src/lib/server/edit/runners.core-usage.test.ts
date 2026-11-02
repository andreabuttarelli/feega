import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runMotionTool = vi.fn();
const runEditorOp = vi.fn();

vi.mock('$lib/server/motion/tool-run', async (real) => ({ ...(await real<object>()), runMotionTool: (...a: unknown[]) => runMotionTool(...a) }));
vi.mock('$lib/server/frame-editor/editor-ops', async (real) => ({ ...(await real<object>()), runEditorOp: (...a: unknown[]) => runEditorOp(...a) }));
vi.mock('$lib/server/motion/editor-scope', () => ({ callerMotionScope: async () => ({ orgId: 'org', userId: 'u1' }) }));

const { runEditorAction, runFrameTool } = await import('./runners');
const { useCoreSink } = await import('$lib/server/core-usage');
const { withToolContext } = await import('$lib/server/ai-log');

const caller = { db: {}, orgId: 'org', userId: 'u1', writeAllowed: true } as never;
let sent: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];

beforeEach(() => {
  sent = [];
  useCoreSink((b) => sent.push(b));
});

afterEach(() => useCoreSink(null));

describe('agent_action from frame tools and the editor', () => {
  it('a frame tool that lands counts, via mcp under a tool call', async () => {
    runMotionTool.mockResolvedValueOnce({ outcome: 'done', version: 2, saved: true, output: {} });

    await withToolContext('edit', () => runFrameTool(caller, { nodeId: 'n1', tool: 'set_text', input: {} }));

    expect(sent).toMatchObject([{ event: 'agent_action', distinct_id: 'u1', properties: { via: 'mcp', op: 'set_text' } }]);
  });

  it('a frame tool that is refused does not count', async () => {
    runMotionTool.mockResolvedValueOnce({ outcome: 'not_found', detail: 'x' });

    await runFrameTool(caller, { nodeId: 'n1', tool: 'set_text', input: {} });

    expect(sent).toEqual([]);
  });

  it('an editor op that lands counts via cli, a conflict does not', async () => {
    runEditorOp.mockResolvedValueOnce({ status: 409, body: { error: 'conflict' } });
    await runEditorAction(caller, { nodeId: 'n1', op: 'read_head', input: {} });
    runEditorOp.mockResolvedValueOnce({ status: 200, body: { version: 3 } });
    await runEditorAction(caller, { nodeId: 'n1', op: 'read_head', input: {} });

    expect(sent).toMatchObject([{ event: 'agent_action', properties: { via: 'cli', op: 'read_head' } }]);
  });
});
