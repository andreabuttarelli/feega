import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const runGenNode = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({
  listMemberships: (...a: unknown[]) => listMemberships(...a)
}));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a)
}));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));
vi.mock('$lib/server/canvas/generate', async (orig) => ({
  ...(await orig<object>()),
  runGenNode: (...a: unknown[]) => runGenNode(...a)
}));

const { actions } = await import('./+page.server');

const ORG = 'org-1';
const CANVAS = 'canvas-1';
const USER = 'user-1';

function event(fields: Record<string, string>, db: unknown) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    params: { canvasId: CANVAS, projectId: 'project-1' },
    locals: {
      safeGetSession: async () => ({ session: {}, user: { id: USER } }),
      db: async () => db
    }
  } as never;
}

const nodeRow = (id: string, type: string) => ({
  id,
  org_id: ORG,
  canvas_id: CANVAS,
  project_id: 'project-1',
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: { prompt: 'p' },
  version: 1,
  deleted_at: null
});

const edge = (id: string, source: string, target: string) => ({
  id,
  org_id: ORG,
  canvas_id: CANVAS,
  source_node_id: source,
  target_node_id: target,
  source_handle: 'derives_from',
  target_handle: 'text',
  mode: 'fixed',
  deleted_at: null
});

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

afterEach(() => vi.unstubAllGlobals());

describe('actions.demo_run', () => {
  it('shows the example results on the chain without generating or calling a provider', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const fake = fakeDb(
      {
        nodes: [nodeRow('t', 'text'), nodeRow('i', 'image'), nodeRow('v', 'video')],
        nodes_connections: [edge('e1', 't', 'i'), edge('e2', 'i', 'v')]
      },
      { filter: true, mutate: true }
    );

    const result = (await actions.demo_run(event({}, fake.db))) as { nodes: { id: string; data: Record<string, unknown> }[] };

    expect(result.nodes.map((n) => n.data.example)).toEqual([true, true, true]);
    expect(runGenNode).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fake.calls.some((c) => c.table === 'node_runs')).toBe(false);
  });

  it('refuses a chain the user has not built yet', async () => {
    const fake = fakeDb({ nodes: [nodeRow('t', 'text')], nodes_connections: [] }, { filter: true });

    const result = (await actions.demo_run(event({}, fake.db))) as { status: number };

    expect(result.status).toBe(400);
  });
});

describe('actions.onboarding_end', () => {
  it('records a dismissal on the profile, only from an active coach', async () => {
    const fake = fakeDb({ profiles: [{ id: USER }] });

    await actions.onboarding_end(event({ status: 'dismissed' }, fake.db));

    const update = fake.calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(update?.payload).toEqual({ onboarding_status: 'dismissed' });
    expect(update?.filters).toEqual([
      ['id', USER],
      ['onboarding_status', 'active']
    ]);
  });

  it('rejects a status that is not an end', async () => {
    const fake = fakeDb({ profiles: [] });

    const result = (await actions.onboarding_end(event({ status: 'active' }, fake.db))) as { status: number };

    expect(result.status).toBe(400);
  });
});
