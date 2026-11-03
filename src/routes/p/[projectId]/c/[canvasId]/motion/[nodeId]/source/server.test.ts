import { beforeEach, describe, expect, it, vi } from 'vitest';

const NODE = '44444444-4444-4444-4444-444444444444';
const OK = 200;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

const found = { orgId: 'o', canvas: { id: 'c', projectId: 'p' } };
const findMotionNode = vi.fn();
const motionSource = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => found }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/motion/editor', () => ({ findMotionNode: (...a: unknown[]) => findMotionNode(...a), motionTokens: async () => ({}) }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects: async () => [{ id: 'p', brandId: null }] }));
vi.mock('$lib/server/motion/sources', () => ({ motionSource: (...a: unknown[]) => motionSource(...a) }));

const { GET } = await import('./+server');

const ask = () =>
  GET({ params: { projectId: 'p', canvasId: 'c', nodeId: NODE }, locals: { safeGetSession: async () => ({ user: { id: 'u' } }), db: async () => ({}) } } as never);

beforeEach(() => vi.clearAllMocks());

describe('motion source', () => {
  it('answers without an error status while a drawn element has no head yet', async () => {
    findMotionNode.mockResolvedValue({ id: NODE });
    motionSource.mockResolvedValue(null);

    expect((await ask()).status).toBe(NO_CONTENT);
  });

  it('answers 404 for a node that is not on the canvas', async () => {
    findMotionNode.mockResolvedValue(null);

    await expect(ask()).rejects.toMatchObject({ status: NOT_FOUND });
  });

  it('serves the head once it exists', async () => {
    findMotionNode.mockResolvedValue({ id: NODE });
    motionSource.mockResolvedValue({ revision: 1, doc: {}, assets: {} });

    expect((await ask()).status).toBe(OK);
  });
});
