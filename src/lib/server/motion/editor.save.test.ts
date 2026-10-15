import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendRevision = vi.fn();
const patchNodeData = vi.fn();

vi.mock('$lib/server/repos/motion-revisions', async (original) => ({ ...(await original<object>()), appendRevision }));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), patchNodeData }));

const { saveMotionDoc } = await import('./editor');
const { RevisionOutcome } = await import('$lib/server/repos/motion-revisions');

const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [], comps: {}, assets: [] };

describe('saving a frame revision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendRevision.mockResolvedValue({ outcome: RevisionOutcome.Written, head: { version: 2, doc } });
    patchNodeData.mockResolvedValue({ outcome: 'written' });
  });

  it('drops the poster of the previous revision, so the canvas never shows a stale still', async () => {
    await saveMotionDoc({} as never, { orgId: 'org', nodeId: 'frame', expectedVersion: 1, doc, actor: { kind: 'user', id: 'u' } as never });

    expect(patchNodeData).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ patch: expect.objectContaining({ docHeadRevision: 2, posterAssetId: null }) }));
  });
});
