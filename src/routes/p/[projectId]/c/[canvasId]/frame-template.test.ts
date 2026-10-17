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

const { actions } = await import('./+page.server');

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

  it('writes the node already pointing at its first revision, and reads nothing it already knows', async () => {
    const fake = fakeDb({ canvases: [{ id: CANVAS, project_id: 'project-1', name: 'Board', viewport: null, org_id: ORG }], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });

    const out = (await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '0', y: '0' }, fake.db))) as { node: { id: string; data: Record<string, unknown> } };

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect((insert?.payload as { data: Record<string, unknown> }).data.docHeadRevision).toBe(1);
    expect(fake.calls.filter((c) => c.table === 'nodes' && c.op !== 'insert')).toEqual([]);
    expect(fake.calls.filter((c) => c.table === 'canvases' || c.table === 'motion_templates')).toEqual([]);
    expect(fake.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert')).toHaveLength(1);
    expect(out.node.data.docHeadRevision).toBe(1);
  });

  it('keeps the id the tab placed the frame under, so the realtime echo is the same tile', async () => {
    const fake = fakeDb({ canvases: [{ id: CANVAS, project_id: 'project-1', name: 'Board', viewport: null, org_id: ORG }], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });
    const id = crypto.randomUUID();

    const out = (await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '0', y: '0', node_id: id }, fake.db))) as { node: { id: string } };

    expect((fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload as { id: string }).id).toBe(id);
    expect(out.node.id).toBe(id);
  });

  it('refuses an id that is not a uuid', async () => {
    const fake = fakeDb({ canvases: [], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });

    const out = (await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '0', y: '0', node_id: 'not-an-id' }, fake.db))) as { status: number };

    expect(out.status).toBe(400);
    expect(fake.calls.filter((c) => c.op === 'insert')).toEqual([]);
  });

  it('says where its time went', async () => {
    const fake = fakeDb({ canvases: [{ id: CANVAS, project_id: 'project-1', name: 'Board', viewport: null, org_id: ORG }], nodes: [], motion_templates: [], motion_revisions: [], canvas_events: [] });
    const setHeaders = vi.fn();

    await actions.frame_template(event({ template: POSTER, format: MotionFormat.Portrait, x: '0', y: '0' }, fake.db, setHeaders));

    expect(setHeaders).toHaveBeenCalledWith({ 'server-timing': expect.stringMatching(/scope;dur=\d+.*start;dur=\d+/) });
  });
});
