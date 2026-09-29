import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { listSourcesForNodes, promoteToPost } from './posts';

describe('promoteToPost: planned_for', () => {
  it('scrive la data pianificata sulla riga', async () => {
    const { db, calls } = fakeDb({ posts: [] });

    await promoteToPost(db, { orgId: 'org-1', brandId: 'brand-1', caption: '', media: [], plannedFor: '2026-10-02T08:00:00.000Z' });

    expect(calls.find((c) => c.op === 'insert')?.payload).toMatchObject({ planned_for: '2026-10-02T08:00:00.000Z' });
  });
});

describe('listSourcesForNodes', () => {
  it('trova i post_sources dei nodi passati, ignorando gli altri', async () => {
    const { db } = fakeDb(
      {
        post_sources: [
          { post_id: 'post-1', node_id: 'node-a', role: 'media' },
          { post_id: 'post-2', node_id: 'node-b', role: 'caption' },
          { post_id: 'post-3', node_id: 'node-c', role: 'media' }
        ]
      },
      { filter: true }
    );

    const result = await listSourcesForNodes(db, ['node-a', 'node-b']);

    expect(result).toEqual([
      { postId: 'post-1', nodeId: 'node-a', role: 'media' },
      { postId: 'post-2', nodeId: 'node-b', role: 'caption' }
    ]);
  });

  it('nessuna query con una lista vuota', async () => {
    const { db, calls } = fakeDb({ post_sources: [] });

    const result = await listSourcesForNodes(db, []);

    expect(result).toEqual([]);
    expect(calls).toEqual([]);
  });
});
