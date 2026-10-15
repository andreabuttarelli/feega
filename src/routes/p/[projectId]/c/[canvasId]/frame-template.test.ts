import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat } from '$lib/motion/doc';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const exportStill = vi.fn(() => new Promise(() => {}));
const chromium = vi.fn(() => new Promise(() => {}));

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: (...a: unknown[]) => listMemberships(...a) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));
vi.mock('$lib/server/motion/still-export', () => ({ exportStill, drawStill: exportStill }));
vi.mock('$lib/server/motion/chromium-frames', () => ({ chromiumFrames: { open: chromium, frame: chromium, close: chromium } }));

const { actions } = await import('$lib/server/canvas/canvas-page');

const ORG = 'org-1';
const CANVAS = 'canvas-1';
const POSTER = 'builtin:poster-type-grid';

function event(fields: Record<string, string>, db: unknown, setHeaders = vi.fn()) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    params: { canvasId: CANVAS, projectId: 'project-1' },
    setHeaders,
    locals: {
      safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
      db: async () => db
    }
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { id: CANVAS, projectId: 'project-1', name: 'Board' }, mode: 'standard' });
});

describe('actions.frame_template', () => {
  it('a 4:5 poster lands as a 4:5 frame node, without waiting on any still render', async () => {
    const fake = fakeDb({ canvases: [{ id: CANVAS, project_id: 'project-1', name: 'Board', viewport: null, org_id: ORG }], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });

    await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '10', y: '20' }, fake.db));

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    const row = insert?.payload as { width: number; height: number; data: { format: string } };
    expect(row.data.format).toBe(MotionFormat.Portrait);
    expect(row.width / (row.height - MOTION_NODE_BAR_H)).toBeCloseTo(4 / 5, 2);
    expect(exportStill).not.toHaveBeenCalled();
    expect(chromium).not.toHaveBeenCalled();
  });

  it('says where its time went', async () => {
    const fake = fakeDb({ canvases: [{ id: CANVAS, project_id: 'project-1', name: 'Board', viewport: null, org_id: ORG }], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });
    const setHeaders = vi.fn();

    await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '0', y: '0' }, fake.db, setHeaders));

    expect(setHeaders).toHaveBeenCalledWith({ 'server-timing': expect.stringMatching(/scope;dur=\d+.*start;dur=\d+/) });
  });
});
