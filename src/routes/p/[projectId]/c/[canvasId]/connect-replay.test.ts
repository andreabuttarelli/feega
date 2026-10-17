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
const LINE = '11111111-1111-4111-8111-111111111111';

function node(id: string) {
  return { id, org_id: ORG, canvas_id: CANVAS, deleted_at: null, type: 'text', data: { prompt: 'hi' }, position: { x: 0, y: 0 } };
}

const line = { id: LINE, org_id: ORG, canvas_id: CANVAS, deleted_at: null, source_node_id: 'a', target_node_id: 'b', source_handle: 'derives_from', target_handle: null, mode: 'fixed' };

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

const connectFields = { source_node_id: 'a', target_node_id: 'b', kind: 'derives_from', connection_id: LINE };

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('a replayed line operation never applies twice', () => {
  it('connect inserts the line under the id the client chose', async () => {
    const { db, calls } = fakeDb({ nodes: [node('a'), node('b')], nodes_connections: [] }, { filter: true });

    await actions.connect(event(connectFields, db));

    const insert = calls.find((c) => c.table === 'nodes_connections' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ id: LINE });
  });

  it('a second connect with the same id returns the existing line and inserts nothing', async () => {
    const { db, calls } = fakeDb({ nodes: [node('a'), node('b')], nodes_connections: [line] }, { filter: true });

    const answer = await actions.connect(event(connectFields, db));

    expect(answer).toMatchObject({ connection: { id: LINE } });
    expect(calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(false);
  });

  it('a second disconnect of a line already gone answers done', async () => {
    const { db } = fakeDb({ nodes: [node('a'), node('b')], nodes_connections: [] }, { filter: true });

    expect(await actions.disconnect(event({ connection_id: LINE }, db))).toEqual({ disconnected: true });
  });
});
