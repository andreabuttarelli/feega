import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { LayerKind } from '$lib/canvas/layers';

const ORG = 'org-1';
const read = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: async (_db: unknown, input: { canvasId: string }) => (input.canvasId === 'c-1' ? { orgId: ORG, canvas: { id: 'c-1', projectId: 'p-1' } } : null)
}));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ readHeads: (...a: unknown[]) => read(...a) }));

const { GET } = await import('./+server');

const call = (canvasId: string, heads: string, user: unknown = { id: 'u-1' }) => {
  const url = new URL(`https://feega.test/p/p-1/c/${canvasId}/frame-outlines?heads=${heads}`);
  const locals = { safeGetSession: async () => ({ user }), db: async () => ({}) };
  return GET({ locals, params: { projectId: 'p-1', canvasId }, url } as never);
};

beforeEach(() => {
  read.mockReset();
  const doc = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0 }, 't1');
  read.mockResolvedValue(new Map([['m1', { version: 4, doc: doc.ok ? doc.doc : null }]]));
});

describe('frame outlines', () => {
  it('answers every requested frame in one read, keyed by node, with its tracks and clips', async () => {
    const body = await (await call('c-1', 'm1:4,m2:7')).json();

    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][1]).toEqual({ orgId: ORG, heads: [{ nodeId: 'm1', version: 4 }, { nodeId: 'm2', version: 7 }] });
    expect(body.m1.find((r: { id: string }) => r.id === 't1')).toMatchObject({ kind: LayerKind.Clip, nodeId: 'm1' });
    expect(body.m2).toBeUndefined();
  });

  it('refuses a stranger and a canvas that is not theirs', async () => {
    await expect(call('c-1', 'm1:4', null)).rejects.toMatchObject({ status: 401 });
    await expect(call('c-9', 'm1:4')).rejects.toMatchObject({ status: 404 });
    expect(read).not.toHaveBeenCalled();
  });
});
