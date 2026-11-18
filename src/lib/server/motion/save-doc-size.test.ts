import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';

const appendRevision = vi.fn();
const patchNodeData = vi.fn();
const resizeNode = vi.fn();

vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));
vi.mock('./linked-mains', () => ({ nudgeInstances: async () => undefined, linkedHead: async (_db: unknown, input: { head: unknown }) => input.head }));
vi.mock('$lib/motion/linked-mains', () => ({ mainHomesOf: () => [] }));
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

describe('the page colour saved with a revision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nodeSized(720, 450);
  });

  const saved = async (head: unknown) => {
    appendRevision.mockResolvedValue({ outcome: 'written', head: { version: 2, doc: head, summary: null, actorKind: 'user' } });
    const write = await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc: page, actor });
    return { write, patch: patchNodeData.mock.calls[0]?.[1].patch };
  };

  it('is the page fill of a drawn frame', async () => {
    const blank = newMotionDoc(MotionFormat.Landscape);
    const bg = newClip({ id: 'bg', from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 1, height: 1, fill: '#07080a' } });

    const { write, patch } = await saved({ ...blank, tracks: [{ ...blank.tracks[0], clips: [bg] }, ...blank.tracks.slice(1)] });

    expect(write.outcome).toBe('written');
    expect(patch.standInFill).toBe('#07080a');
  });

  it.each([
    ['no tracks', page],
    ['tracks without clips', { ...page, tracks: [{}] }],
    ['a shape without props', { ...page, tracks: [{ clips: [{ id: 'a', component: 'Shape' }] }] }]
  ])('is left out, and the save still lands, for a head with %s', async (_, head) => {
    const { write, patch } = await saved(head);

    expect(write.outcome).toBe('written');
    expect(patch.standInFill).toBeUndefined();
  });
});

