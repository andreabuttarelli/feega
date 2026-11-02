import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { Db } from '$lib/server/db/client';

const createNode = vi.fn();
const deleteNode = vi.fn();
const appendRevision = vi.fn();

vi.mock('$lib/server/repos/canvas', async (actual) => ({
  ...(await actual<object>()),
  createNode: (...args: unknown[]) => createNode(...args),
  deleteNode: (...args: unknown[]) => deleteNode(...args)
}));
vi.mock('$lib/server/repos/motion-revisions', async (actual) => ({
  ...(await actual<object>()),
  appendRevision: (...args: unknown[]) => appendRevision(...args)
}));

const { DocRejected, frameStore, placeFigmaPlan } = await import('./move-element');

const SCOPE = { orgId: 'o1', actor: { kind: 'user', id: 'u1' } as const, projectId: 'p1' };
const PLACE = { projectId: 'p1', canvasId: 'c1' };
const AT = { ...PLACE, x: 0, y: 0 };
const REJECTION = 'tracks.0.clips.2.props.fontSize: expected number';

beforeEach(() => {
  vi.clearAllMocks();
  createNode.mockResolvedValue({ id: 'n1' });
  deleteNode.mockResolvedValue(undefined);
});

describe('frameStore.create', () => {
  it('a doc the schema rejects makes no frame: the empty node is removed and the reason is thrown', async () => {
    appendRevision.mockResolvedValue({ outcome: RevisionOutcome.Invalid, error: REJECTION });

    const made = frameStore({} as Db, SCOPE).create(AT, newMotionDoc(MotionFormat.Landscape));

    await expect(made).rejects.toThrow(REJECTION);
    await expect(made).rejects.toBeInstanceOf(DocRejected);
    expect(deleteNode).toHaveBeenCalledWith({}, { orgId: 'o1', nodeId: 'n1', actor: SCOPE.actor });
  });

  it('a revision that lost a race makes no frame either', async () => {
    appendRevision.mockResolvedValue({ outcome: RevisionOutcome.Conflict });

    await expect(frameStore({} as Db, SCOPE).create(AT, newMotionDoc(MotionFormat.Landscape))).rejects.toBeInstanceOf(DocRejected);
    expect(deleteNode).toHaveBeenCalled();
  });

  it('a doc that is written keeps its frame', async () => {
    appendRevision.mockResolvedValue({ outcome: RevisionOutcome.Written, head: { version: 1 } });

    await expect(frameStore({} as Db, SCOPE).create(AT, newMotionDoc(MotionFormat.Landscape))).resolves.toBe('n1');
    expect(deleteNode).not.toHaveBeenCalled();
  });
});

describe('placeFigmaPlan', () => {
  it('when a later frame is rejected, the earlier ones of the same paste are removed too', async () => {
    const removed: string[] = [];
    const store = {
      create: vi.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new DocRejected(REJECTION)),
      remove: async (id: string) => {
        removed.push(id);
      }
    } as never;
    const item = { name: 'Page', doc: newMotionDoc(MotionFormat.Landscape), centre: { x: 0, y: 0 }, size: { width: 100, height: 100 }, images: [], destination: 'frame' };

    await expect(placeFigmaPlan(store, PLACE, { items: [item, item] as never, skipped: [], fileKey: null }, { x: 0, y: 0 })).rejects.toBeInstanceOf(DocRejected);

    expect(removed).toEqual(['first']);
  });
});
