import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '$lib/motion/main-component';
import type { Db } from '$lib/server/db/client';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function buttonDoc() {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy' } }, 'label'));
  const doc = must(createComponent(base, ['label'], () => 'cmp', 'Button'));
  const instance = doc.tracks.flatMap((t) => t.clips)[0] as MotionClip;
  return { doc, compId: String(instance.props.comp) };
}

const button = buttonDoc();
const docs: Record<string, MotionDoc> = { f1: button.doc, f2: newMotionDoc(MotionFormat.Landscape), set: button.doc };

vi.mock('$lib/server/repos/canvas', () => ({
  listCanvases: async () => [
    { id: 'c1', projectId: 'p', name: 'Home', viewport: null },
    { id: 'c2', projectId: 'p', name: 'Empty', viewport: null },
    { id: 'c3', projectId: 'p', name: 'Components', viewport: null }
  ],
  listMotionNodes: async () => [
    { id: 'f1', canvasId: 'c1', data: { posterAssetId: 'a1', docHeadRevision: 1 } },
    { id: 'f2', canvasId: 'c2', data: {} }
  ],
  listNodes: async (_db: Db, scope: { canvasId: string }) => (scope.canvasId === 'c3' ? [{ id: 'set', canvasId: 'c3', type: 'element', data: {} }, { id: 'note', canvasId: 'c3', type: 'text', data: {} }] : [])
}));

const reads = vi.hoisted(() => ({ one: [] as string[], batches: 0 }));

vi.mock('$lib/server/repos/motion-revisions', () => ({
  readHead: async (_db: Db, input: { nodeId: string }) => {
    reads.one.push(input.nodeId);
    return { version: 1, doc: docs[input.nodeId], summary: null, actorKind: 'user' };
  },
  readHeads: async (_db: Db, input: { heads: { nodeId: string; version: number }[] }) => {
    reads.batches += 1;
    return new Map(input.heads.map((h) => [h.nodeId, { version: h.version, doc: docs[h.nodeId], summary: null, actorKind: 'user' }]));
  }
}));

const { listProjectComponents, readComponentSource } = await import('./project-components');
const db = {} as Db;
const scope = { orgId: 'o', projectId: 'p' };

describe('components across the canvases of a project', () => {
  it('groups them by canvas, with the poster of the frame that holds them', async () => {
    const found = await listProjectComponents(db, scope);

    expect(found.map((c) => c.canvasName)).toEqual(['Home', 'Components']);
    expect(found[0]).toMatchObject({ canvasId: 'c1', canvasName: 'Home' });
    expect(found[0].components[0]).toMatchObject({ frameId: 'f1', name: 'Button', thumb: '/p/p/c/c1/assets/a1', revision: 1 });
  });

  it('lists the sets an import lays on the Components page, which are element frames, so Go to main finds them (vercel import: Go to main did nothing)', async () => {
    const found = await listProjectComponents(db, scope);

    expect(found.find((c) => c.canvasName === 'Components')?.components[0]).toMatchObject({ frameId: 'set', name: 'Button' });
  });

  it('reads the frames whose head it knows in one batch, not one query per frame (Components panel took 20 s with 180 sets)', async () => {
    reads.one = [];
    reads.batches = 0;

    await listProjectComponents(db, { ...scope, orgId: 'fresh' });

    expect(reads.batches).toBe(1);
    expect(reads.one).not.toContain('f1');
  });

  it('a second listing with the same revisions reads no doc again (every canvas open read 25 MB of docs)', async () => {
    await listProjectComponents(db, scope);
    reads.one = [];
    reads.batches = 0;

    const again = await listProjectComponents(db, scope);

    expect(reads.batches).toBe(0);
    expect(reads.one).not.toContain('f1');
    expect(again[0].components[0]).toMatchObject({ frameId: 'f1', name: 'Button' });
  });

  it('hands over the main alone, ready to place on another canvas', async () => {
    const source = await readComponentSource(db, { ...scope, frameId: 'f1', compId: button.compId });

    expect(source && Object.keys(source.comps)).toEqual([button.compId]);
  });

  it('refuses a frame outside the project or a comp that is not a main', async () => {
    expect(await readComponentSource(db, { ...scope, frameId: 'elsewhere', compId: button.compId })).toBeNull();
    expect(await readComponentSource(db, { ...scope, frameId: 'f1', compId: 'nope' })).toBeNull();
  });
});
