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
const docs: Record<string, MotionDoc> = { f1: button.doc, f2: newMotionDoc(MotionFormat.Landscape) };

vi.mock('$lib/server/repos/canvas', () => ({
  listCanvases: async () => [
    { id: 'c1', projectId: 'p', name: 'Home', viewport: null },
    { id: 'c2', projectId: 'p', name: 'Empty', viewport: null }
  ],
  listMotionNodes: async () => [
    { id: 'f1', canvasId: 'c1', data: { posterAssetId: 'a1' } },
    { id: 'f2', canvasId: 'c2', data: {} }
  ]
}));

vi.mock('$lib/server/repos/motion-revisions', () => ({
  readHead: async (_db: Db, input: { nodeId: string }) => ({ version: 1, doc: docs[input.nodeId], summary: null, actorKind: 'user' })
}));

const { listProjectComponents, readComponentSource } = await import('./project-components');
const db = {} as Db;
const scope = { orgId: 'o', projectId: 'p' };

describe('components across the canvases of a project', () => {
  it('groups them by canvas, with the poster of the frame that holds them', async () => {
    const found = await listProjectComponents(db, scope);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ canvasId: 'c1', canvasName: 'Home' });
    expect(found[0].components[0]).toMatchObject({ frameId: 'f1', name: 'Button', thumb: '/p/p/c/c1/assets/a1', revision: 1 });
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
