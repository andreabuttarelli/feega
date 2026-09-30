import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { CANVAS_TEMPLATES } from '$lib/canvas/templates';

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

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('actions.template', () => {
  it('posa il template scelto sulla tela, nodi e archi, attorno al punto dato', async () => {
    const [template] = CANVAS_TEMPLATES;
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const result = (await actions.template(event({ template_id: template.id, x: '100', y: '200' }, fake.db))) as {
      nodes: unknown[];
      connections: unknown[];
    };

    expect(result.nodes).toHaveLength(template.nodes.length);
    expect(result.connections).toHaveLength(template.edges.length);
    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ org_id: ORG, canvas_id: CANVAS, project_id: 'project-1' });
  });

  it('un template che non esiste è un 400, non una tela sporca', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const result = await actions.template(event({ template_id: 'non-esiste', x: '0', y: '0' }, fake.db));

    expect(result).toMatchObject({ status: 400 });
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('una posizione non numerica è un 400', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const result = await actions.template(event({ template_id: CANVAS_TEMPLATES[0].id, x: 'a', y: '0' }, fake.db));

    expect(result).toMatchObject({ status: 400 });
  });
});
