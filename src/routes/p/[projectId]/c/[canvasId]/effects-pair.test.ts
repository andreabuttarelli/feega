import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const makeEffectsPair = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: (...a: unknown[]) => listMemberships(...a) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));
vi.mock('$lib/server/canvas/effects-actions', async (original) => ({
  ...(await original<object>()),
  makeEffectsPair: (...a: unknown[]) => makeEffectsPair(...a)
}));

const { actions } = await import('./+page.server');

const twin = { id: 'fx-2', org_id: 'org-1', canvas_id: 'canvas-1', project_id: 'project-1', type: 'effects', data: {}, x: 0, y: 0, z: 0, width: null, height: null, display_name: null, version: 1, deleted_at: null };
const edge = { id: 'e-2', org_id: 'org-1', canvas_id: 'canvas-1', source_node_id: 'image-1', target_node_id: 'fx-2', source_handle: null, target_handle: 'images', mode: 'fixed', deleted_at: null };

function event(fields: Record<string, string>, db: unknown) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    params: { canvasId: 'canvas-1', projectId: 'project-1' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }), db: async () => db }
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: 'org-1', canvas: { projectId: 'project-1' } });
});

describe('actions.effects_pair', () => {
  it('runs the same pair as chat and MCP, signed by the person, and returns the twin with its wire', async () => {
    makeEffectsPair.mockResolvedValue({ outcome: 'applied', nodeId: 'fx-2', assetId: 'asset-b' });
    const { db } = fakeDb({ nodes: [twin], nodes_connections: [edge] }, { filter: true });

    const out = (await actions.effects_pair(event({ node_id: 'fx-1' }, db))) as Record<string, { id: string }>;

    expect(makeEffectsPair).toHaveBeenCalledWith(db, expect.objectContaining({ orgId: 'org-1', nodeId: 'fx-1', actor: expect.objectContaining({ kind: 'user', id: 'user-1' }) }));
    expect(out.node.id).toBe('fx-2');
    expect(out.connection.id).toBe('e-2');
  });

  it('a refusal comes back as a 400', async () => {
    makeEffectsPair.mockResolvedValue({ outcome: 'refused', error: 'no_shape_cutout' });

    const out = (await actions.effects_pair(event({ node_id: 'fx-1' }, fakeDb({}).db))) as { status: number };

    expect(out.status).toBe(400);
  });
});
