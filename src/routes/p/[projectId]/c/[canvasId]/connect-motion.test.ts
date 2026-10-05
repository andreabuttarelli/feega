import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({
  listMemberships: (...a: unknown[]) => listMemberships(...a)
}));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a)
}));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));

const { actions } = await import('./+page.server');

const ORG = 'org-1';
const CANVAS = 'canvas-1';

function node(id: string, type: string, data: Record<string, unknown>) {
  return { id, org_id: ORG, canvas_id: CANVAS, deleted_at: null, type, data, position: { x: 0, y: 0 } };
}

function event(fields: Record<string, string>, db: unknown) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    params: { canvasId: CANVAS, projectId: 'project-1' },
    locals: {
      safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
      db: async () => db
    }
  } as never;
}

function connect(source: ReturnType<typeof node>, target: ReturnType<typeof node>) {
  const { db } = fakeDb({ nodes: [source, target], nodes_connections: [] }, { filter: true });
  return actions.connect(event({ source_node_id: source.id, target_node_id: target.id, kind: 'derives_from' }, db));
}

const COMPOSITION = node('node-comp', 'composition', { layout: 'bento', layoutParams: {}, camera: { preset: 'static', params: {} }, background: { color: '#000000' }, duration: 6, aspect: '16:9', refId: null });
const MOTION = node('node-motion', 'motion', { format: 'landscape', docHeadRevision: 3, posterAssetId: null, lastRenderAssetId: null });

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('actions.connect a motion editor into a composition', () => {
  it('accepts the motion as an input of the composition', async () => {
    expect(await connect(MOTION, COMPOSITION)).toMatchObject({ connection: { sourceNodeId: 'node-motion', targetNodeId: 'node-comp' } });
  });

  it('refuses a motion into a node that renders pictures from a prompt', async () => {
    expect(await connect(MOTION, node('node-img', 'image', { prompt: 'a cat' }))).toMatchObject({ status: 400 });
  });

  it('refuses a composition into a motion, so composition, motion, composition never closes a loop', async () => {
    expect(await connect(COMPOSITION, MOTION)).toMatchObject({ status: 400 });
  });
});
