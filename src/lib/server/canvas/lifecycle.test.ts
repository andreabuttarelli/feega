import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { CanvasRemoval, nextCanvasName, openNewCanvas, removeCanvas, renameCanvasTo } from '$lib/server/canvas/lifecycle';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const PROJECT = 'project-1';

const canvasRow = (id: string, name: string, orgId = ORG) => ({ id, org_id: orgId, project_id: PROJECT, name, viewport: null });

describe('nextCanvasName', () => {
  it('starts at 1 on a project without untitled canvases', () => {
    expect(nextCanvasName(['Moodboard'])).toBe('Untitled canvas 1');
  });

  it('skips numbers already taken', () => {
    expect(nextCanvasName(['Untitled canvas 1', 'Untitled canvas 3'])).toBe('Untitled canvas 4');
  });
});

describe('openNewCanvas', () => {
  it('inserts the next untitled canvas for the project org', async () => {
    const { db, calls } = fakeDb({ canvases: [canvasRow('c-1', 'Untitled canvas 1')] }, { filter: true });

    await openNewCanvas(db, { orgId: ORG, projectId: PROJECT });

    const insert = calls.find((c) => c.table === 'canvases' && c.op === 'insert');
    expect(insert?.payload).toEqual({ org_id: ORG, project_id: PROJECT, name: 'Untitled canvas 2' });
  });
});

describe('renameCanvasTo', () => {
  it('writes the trimmed name scoped to the org', async () => {
    const { db, calls } = fakeDb({ canvases: [canvasRow('c-1', 'Old')] }, { filter: true });

    const renamed = await renameCanvasTo(db, { orgId: ORG, canvasId: 'c-1', name: '  Moodboard  ' });

    const update = calls.find((c) => c.table === 'canvases' && c.op === 'update');
    expect(update?.payload).toMatchObject({ name: 'Moodboard' });
    expect(update?.filters).toContainEqual(['org_id', ORG]);
    expect(renamed).toBe(true);
  });

  it('refuses an empty name', async () => {
    const { db, calls } = fakeDb({ canvases: [canvasRow('c-1', 'Old')] }, { filter: true });

    expect(await renameCanvasTo(db, { orgId: ORG, canvasId: 'c-1', name: '   ' })).toBe(false);
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('does not rename another org canvas', async () => {
    const { db } = fakeDb({ canvases: [canvasRow('c-1', 'Old', OTHER_ORG)] }, { filter: true });

    expect(await renameCanvasTo(db, { orgId: ORG, canvasId: 'c-1', name: 'Mine' })).toBe(false);
  });
});

describe('removeCanvas', () => {
  it('refuses to delete the last canvas of a project', async () => {
    const { db, calls } = fakeDb({ canvases: [canvasRow('c-1', 'Only')] }, { filter: true });

    const result = await removeCanvas(db, { orgId: ORG, projectId: PROJECT, canvasId: 'c-1' });

    expect(result).toEqual({ outcome: CanvasRemoval.LastCanvas });
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('deletes and points to the canvas that remains', async () => {
    const { db, calls } = fakeDb({ canvases: [canvasRow('c-1', 'A'), canvasRow('c-2', 'B')] }, { filter: true });

    const result = await removeCanvas(db, { orgId: ORG, projectId: PROJECT, canvasId: 'c-1' });

    expect(result).toEqual({ outcome: CanvasRemoval.Removed, nextCanvasId: 'c-2' });
    const del = calls.find((c) => c.table === 'canvases' && c.op === 'delete');
    expect(del?.filters).toEqual(expect.arrayContaining([['id', 'c-1'], ['org_id', ORG]]));
  });
});
