import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { motionSources, sourcesJson, warmSources } from './sources';

const FRAME = '00000000-0000-4000-8000-000000000001';
const TOKENS = { fonts: [] };

const node = { id: FRAME, org_id: 'org-a', canvas_id: 'c1', project_id: 'p1', deleted_at: null, type: 'motion', data: { format: 'landscape', docHeadRevision: 1 }, position: { x: 0, y: 0 } };
const revision = { org_id: 'org-a', node_id: FRAME, version: 1, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actor_kind: 'user' };
const scope = (db: ReturnType<typeof fakeDb>['db']) => ({ db, orgId: 'org-a', projectId: 'p1', canvasId: 'c1', nodeIds: [FRAME], sign: async () => new Map() });

afterEach(() => vi.restoreAllMocks());

describe('the frame sources of a canvas', () => {
  it('are written as the JSON of what motionSources read', async () => {
    const { db } = fakeDb({ nodes: [node], motion_revisions: [revision], assets: [] }, { filter: true });
    const sources = await motionSources(scope(db));

    expect(JSON.parse(sourcesJson(TOKENS, sources))).toEqual(JSON.parse(JSON.stringify({ tokens: TOKENS, frames: Object.fromEntries(sources.frames), signed: sources.signed })));
  });

  it('once warmed, are answered without writing any frame doc out again', async () => {
    const { db } = fakeDb({ nodes: [node], motion_revisions: [revision], assets: [] }, { filter: true });
    await warmSources(scope(db));
    const sources = await motionSources(scope(db));
    const doc = sources.frames.get(FRAME)!.doc;
    const written = vi.spyOn(JSON, 'stringify');

    sourcesJson(TOKENS, sources);

    expect(written.mock.calls.some(([value]) => value === doc)).toBe(false);
  });
});
