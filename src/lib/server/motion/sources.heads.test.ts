import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { motionSources } from './sources';

const POSTGREST_MAX_ROWS = 1000;
const REVISIONS = 1200;
const POINTED = '00000000-0000-4000-8000-000000000001';
const UNPOINTED = '00000000-0000-4000-8000-000000000002';

const node = (id: string, data: Record<string, unknown>) => ({ id, org_id: 'org-a', canvas_id: 'c1', project_id: 'p1', deleted_at: null, type: 'motion', data: { format: 'landscape', ...data }, position: { x: 0, y: 0 } });
const history = (id: string) =>
  Array.from({ length: REVISIONS }, (_, i) => ({ org_id: 'org-a', node_id: id, version: i + 1, doc: { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: i + 1 }, summary: null, actor_kind: 'user' }));

describe('the head of a frame with a long history', () => {
  it('is its newest revision, even past the rows one response can carry', async () => {
    const { db, calls } = fakeDb(
      { nodes: [node(POINTED, { docHeadRevision: REVISIONS }), node(UNPOINTED, {})], motion_revisions: [...history(POINTED), ...history(UNPOINTED)], assets: [] },
      { filter: true, maxRows: POSTGREST_MAX_ROWS }
    );

    const sources = await motionSources({ db, orgId: 'org-a', projectId: 'p1', canvasId: 'c1', nodeIds: [POINTED, UNPOINTED], sign: async () => new Map() });

    expect(sources.get(POINTED)?.revision).toBe(REVISIONS);
    expect(sources.get(UNPOINTED)?.revision).toBe(REVISIONS);
    expect(calls.filter((c) => c.table === 'motion_revisions' && !c.limit && !c.ors)).toHaveLength(0);
  });
});
