import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendRevision = vi.fn();
const patchNodeData = vi.fn();
const resizeNode = vi.fn();

vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));
vi.mock('$lib/server/repos/canvas', () => ({ patchNodeData, resizeNode, findNode: vi.fn(), DataCheck: { Schema: 'schema', None: 'none' } }));

const { saveMotionDoc } = await import('./editor');

const db = {} as never;
const actor = { kind: 'user' as const, id: 'u' };
const page = { width: 1440, height: 900 };

function nodeSized(width: number | null, height: number | null, kind = 'frame') {
  patchNodeData.mockResolvedValue({ outcome: 'written', node: { id: 'n', type: 'motion', data: { format: 'custom', kind }, size: { width, height } } });
}

describe('saving a frame doc resizes its node to the doc canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendRevision.mockResolvedValue({ outcome: 'written', head: { version: 2, doc: page, summary: null, actorKind: 'user' } });
  });

  it('a node created with no size gets one from the doc', async () => {
    nodeSized(null, null);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: page, actor });

    expect(resizeNode).toHaveBeenCalledWith(db, { orgId: 'o', nodeId: 'n', width: 420, height: 263 });
  });

  it('a node already at the doc aspect is not written again', async () => {
    nodeSized(720, 450);

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: page, actor });

    expect(resizeNode).not.toHaveBeenCalled();
  });

  it('a free element keeps its canvas size', async () => {
    nodeSized(100, 100, 'element');

    await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: page, actor });

    expect(resizeNode).not.toHaveBeenCalled();
  });
});
