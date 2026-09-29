import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { PlanScope, PlanOutcome, listPlannedPosts, planPost } from './post-planning';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

function post(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    org_id: ORG,
    brand_id: 'brand-1',
    title: null,
    caption: `caption ${id}`,
    per_platform: null,
    media: [],
    link_url: null,
    status: 'draft',
    planned_for: '2026-10-02T08:00:00.000Z',
    updated_at: '2026-09-29T10:00:00.000Z',
    created_at: '2026-09-29T10:00:00.000Z',
    zernio_post_ids: {},
    ...over
  };
}

const rows = () => ({
  nodes: [
    { id: 'node-a', org_id: ORG, canvas_id: 'canvas-1', deleted_at: null },
    { id: 'node-b', org_id: ORG, canvas_id: 'canvas-2', deleted_at: null },
    { id: 'node-x', org_id: OTHER_ORG, canvas_id: 'canvas-1', deleted_at: null }
  ],
  post_sources: [
    { post_id: 'post-canvas', node_id: 'node-a', role: 'media' },
    { post_id: 'post-elsewhere', node_id: 'node-b', role: 'media' },
    { post_id: 'post-foreign', node_id: 'node-x', role: 'media' }
  ],
  posts: [
    post('post-canvas'),
    post('post-elsewhere'),
    post('post-foreign', { org_id: OTHER_ORG }),
    post('post-scheduled', { status: 'ready', zernio_post_ids: { 'acc-1': 'z-1' } }),
    post('post-other-brand', { brand_id: 'brand-2' })
  ]
});

describe('listPlannedPosts', () => {
  it('scope tela: solo i post nati da nodi di questa tela e di questa org', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const posts = await listPlannedPosts(db, { orgId: ORG, scope: { kind: PlanScope.Canvas, canvasId: 'canvas-1' } });

    expect(posts.map((p) => p.id)).toEqual(['post-canvas']);
    expect(posts[0]).toMatchObject({
      plannedFor: '2026-10-02T08:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
      scheduled: false,
      sourceNodeIds: ['node-a']
    });
  });

  it('scope brand: tutti i post non archiviati del brand, pianificati o consegnati', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const posts = await listPlannedPosts(db, { orgId: ORG, scope: { kind: PlanScope.Brand, brandId: 'brand-1' } });

    expect(posts.map((p) => p.id).sort()).toEqual(['post-canvas', 'post-elsewhere', 'post-scheduled']);
    expect(posts.find((p) => p.id === 'post-scheduled')?.scheduled).toBe(true);
  });

  it('un’altra org non vede nulla della tela anche con lo stesso canvasId', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const posts = await listPlannedPosts(db, { orgId: OTHER_ORG, scope: { kind: PlanScope.Canvas, canvasId: 'canvas-1' } });

    expect(posts.map((p) => p.id)).toEqual(['post-foreign']);
  });
});

describe('planPost', () => {
  it('scrive planned_for solo se updated_at è quello atteso', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true, mutate: true });

    const result = await planPost(db, {
      orgId: ORG,
      postId: 'post-canvas',
      plannedFor: '2026-10-05T08:00:00.000Z',
      expectedUpdatedAt: '2026-09-29T10:00:00.000Z'
    });

    expect(result.outcome).toBe(PlanOutcome.Planned);
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.filters).toContainEqual(['updated_at', '2026-09-29T10:00:00.000Z']);
    expect(update.payload).toMatchObject({ planned_for: '2026-10-05T08:00:00.000Z' });
  });

  it('un updated_at vecchio è un conflitto, non un successo silenzioso', async () => {
    const { db } = fakeDb(rows(), { filter: true, mutate: true });

    const result = await planPost(db, {
      orgId: ORG,
      postId: 'post-canvas',
      plannedFor: '2026-10-05T08:00:00.000Z',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z'
    });

    expect(result.outcome).toBe(PlanOutcome.Conflict);
  });

  it('il post di un’altra org è sparito, non spostato', async () => {
    const { db } = fakeDb(rows(), { filter: true, mutate: true });

    const result = await planPost(db, {
      orgId: ORG,
      postId: 'post-foreign',
      plannedFor: '2026-10-05T08:00:00.000Z',
      expectedUpdatedAt: '2026-09-29T10:00:00.000Z'
    });

    expect(result.outcome).toBe(PlanOutcome.Gone);
  });
});
