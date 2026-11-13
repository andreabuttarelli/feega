import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { readSharedSource } from './frame-share';

const DOC = { width: 1080, height: 1080, fps: 30, durationInFrames: 30, clips: [] };

function node(id: string, canvas_id: string, type = 'motion', deleted_at: string | null = null) {
  return { id, canvas_id, project_id: 'project-1', org_id: 'org-1', type, display_name: id, x: 0, y: 0, z: 0, width: null, height: null, data: { docHeadRevision: 2 }, version: 1, deleted_at };
}

const revision = (node_id: string, version: number) => ({ org_id: 'org-1', node_id, version, doc: { ...DOC, durationInFrames: version }, summary: null, actor_kind: 'user' });

function sharedDb() {
  return fakeDb(
    {
      canvases: [
        { id: 'canvas-1', org_id: 'org-1', project_id: 'project-1', name: 'Launch', share_token: 'tok-live', deleted_at: null },
        { id: 'canvas-2', org_id: 'org-1', project_id: 'project-1', name: 'Private', share_token: null, deleted_at: null }
      ],
      projects: [{ id: 'project-1', org_id: 'org-1', mode: 'standard', brand_id: null }],
      nodes: [node('f1', 'canvas-1'), node('el', 'canvas-1', 'element'), node('img', 'canvas-1', 'image'), node('gone', 'canvas-1', 'motion', '2026-09-01T00:00:00Z'), node('secret', 'canvas-2')],
      motion_revisions: [revision('f1', 2), revision('el', 1), revision('secret', 1), revision('gone', 1)],
      assets: [],
      brands: []
    },
    { filter: true }
  ).db;
}

describe('readSharedSource: a visitor with the link reads frames of that canvas only', () => {
  it('an unknown token reads nothing', async () => {
    expect(await readSharedSource(sharedDb(), 'nope', 'f1')).toBeNull();
  });

  it('a frame on another canvas of the same org reads nothing', async () => {
    expect(await readSharedSource(sharedDb(), 'tok-live', 'secret')).toBeNull();
  });

  it('a node that holds no doc, or is deleted, reads nothing', async () => {
    expect(await readSharedSource(sharedDb(), 'tok-live', 'img')).toBeNull();
    expect(await readSharedSource(sharedDb(), 'tok-live', 'gone')).toBeNull();
  });

  it('an unpublished frame reads at its current revision', async () => {
    const source = await readSharedSource(sharedDb(), 'tok-live', 'f1');

    expect(source).toMatchObject({ revision: 2, doc: { durationInFrames: 2 } });
    expect(source?.tokens).toBeTruthy();
  });

  it('an element reads too', async () => {
    expect(await readSharedSource(sharedDb(), 'tok-live', 'el')).toMatchObject({ revision: 1 });
  });
});
