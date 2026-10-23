import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { readSharedFrame } from './frame-share';

const CANVAS = { id: 'canvas-1', org_id: 'org-1', project_id: 'project-1', name: 'Launch', share_token: 'tok-live', deleted_at: null };

function frame(id: string, name: string, type = 'motion', deleted_at: string | null = null, y = 0) {
  return { id, canvas_id: 'canvas-1', project_id: 'project-1', org_id: 'org-1', type, display_name: name, x: 0, y, z: 0, width: null, height: null, data: {}, version: 1, deleted_at };
}

function sharedDb() {
  return fakeDb(
    {
      canvases: [CANVAS],
      projects: [{ id: 'project-1', org_id: 'org-1', mode: 'standard' }],
      nodes: [frame('f1', 'Intro'), frame('f2', 'Outro', 'motion', null, 400), frame('img', 'Pic', 'image'), frame('gone', 'Old', 'motion', '2026-09-01T00:00:00Z')]
    },
    { filter: true }
  ).db;
}

const published = (ids: string[]) => async (id: string) => ids.includes(id);

describe('readSharedFrame', () => {
  it('an unknown token reads nothing', async () => {
    expect(await readSharedFrame(sharedDb(), 'nope', 'f1', published(['f1']))).toBeNull();
  });

  it('a frame that is not on the shared canvas reads nothing', async () => {
    expect(await readSharedFrame(sharedDb(), 'tok-live', 'other', published(['other']))).toBeNull();
  });

  it('a node that is not a motion frame reads nothing', async () => {
    expect(await readSharedFrame(sharedDb(), 'tok-live', 'img', published(['img']))).toBeNull();
  });

  it('a deleted frame reads nothing', async () => {
    expect(await readSharedFrame(sharedDb(), 'tok-live', 'gone', published(['gone']))).toBeNull();
  });

  it('a frame that was never published as an embed reads nothing', async () => {
    expect(await readSharedFrame(sharedDb(), 'tok-live', 'f1', published([]))).toBeNull();
  });

  it('returns the frame with its published siblings, in canvas order', async () => {
    const shared = await readSharedFrame(sharedDb(), 'tok-live', 'f2', published(['f1', 'f2']));

    expect(shared).toEqual({
      canvasName: 'Launch',
      frameId: 'f2',
      title: 'Outro',
      frames: [
        { id: 'f1', title: 'Intro' },
        { id: 'f2', title: 'Outro' }
      ]
    });
  });

  it('leaves unpublished siblings out of the swipe list', async () => {
    const shared = await readSharedFrame(sharedDb(), 'tok-live', 'f1', published(['f1']));

    expect(shared?.frames).toEqual([{ id: 'f1', title: 'Intro' }]);
  });
});
