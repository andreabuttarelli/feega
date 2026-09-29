import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: (...a: unknown[]) => listMemberships(...a) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));

import { actions } from './+page.server';

const ORG = 'org-1';
const PROJECT = 'project-1';
const canvasRow = (id: string, name: string) => ({ id, org_id: ORG, project_id: PROJECT, name, viewport: null });

function eventWith(rows: Record<string, unknown[]>, form: Record<string, string> = {}) {
  const { db, calls } = fakeDb(rows, { filter: true });
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) {
    fd.set(k, v);
  }
  const ev = {
    request: { formData: () => Promise.resolve(fd) },
    params: { projectId: PROJECT, canvasId: 'c-1' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }), db: async () => db }
  } as never;
  return { ev, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { id: 'c-1', projectId: PROJECT, name: 'A', viewport: null } });
});

describe('canvas lifecycle actions', () => {
  it('new_canvas creates the next untitled canvas and redirects to it', async () => {
    const { ev, calls } = eventWith({ canvases: [canvasRow('c-1', 'Untitled canvas 1')] });

    await expect(actions.new_canvas(ev)).rejects.toMatchObject({ status: 303, location: expect.stringMatching(`^/p/${PROJECT}/c/`) });
    expect(calls.find((c) => c.table === 'canvases' && c.op === 'insert')?.payload).toMatchObject({ name: 'Untitled canvas 2' });
  });

  it('rename_canvas renames the canvas', async () => {
    const { ev, calls } = eventWith({ canvases: [canvasRow('c-1', 'A')] }, { name: 'Moodboard' });

    await actions.rename_canvas(ev);

    expect(calls.find((c) => c.table === 'canvases' && c.op === 'update')?.payload).toMatchObject({ name: 'Moodboard' });
  });

  it('delete_canvas refuses the last canvas', async () => {
    const { ev, calls } = eventWith({ canvases: [canvasRow('c-1', 'A')] });

    const result = await actions.delete_canvas(ev);

    expect(result).toMatchObject({ status: 409 });
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('delete_canvas removes it and redirects to another canvas', async () => {
    const { ev } = eventWith({ canvases: [canvasRow('c-1', 'A'), canvasRow('c-2', 'B')] });

    await expect(actions.delete_canvas(ev)).rejects.toMatchObject({ status: 303, location: `/p/${PROJECT}/c/c-2` });
  });

  it.each(['new_canvas', 'rename_canvas', 'delete_canvas'] as const)('%s refuses a canvas of another org', async (name) => {
    findCanvasForUser.mockResolvedValue(null);
    const { ev, calls } = eventWith({ canvases: [canvasRow('c-1', 'A'), canvasRow('c-2', 'B')] }, { name: 'X' });

    await expect(actions[name](ev)).rejects.toMatchObject({ status: 404 });
    expect(calls.some((c) => c.op !== 'select')).toBe(false);
  });
});
