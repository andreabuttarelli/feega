import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { homed } from '$lib/motion/canvas-components';
import { createComponent } from '$lib/motion/main-component';
import type { Db } from '$lib/server/db/client';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy' } }, 'label'));
const sheet = must(createComponent(base, ['label'], () => 'cmp', 'Button'));
const compId = String((sheet.tracks.flatMap((t) => t.clips)[0] as MotionClip).props.comp);
const docs: Record<string, MotionDoc> = { page: homed(sheet, 'sheet'), sheet };

vi.mock('$lib/server/repos/canvas', () => ({
  listCanvases: async () => [{ id: 'c1', projectId: 'p', name: 'Home', viewport: null }],
  listMotionNodes: async () => [
    { id: 'page', canvasId: 'c1', data: {}, displayName: 'Page' },
    { id: 'sheet', canvasId: 'c1', data: {}, displayName: 'Components' }
  ]
}));

vi.mock('$lib/server/repos/motion-revisions', () => ({
  readHead: async (_db: Db, input: { nodeId: string }) => ({ version: 1, doc: docs[input.nodeId], summary: null, actorKind: 'user' })
}));

const { listProjectComponents } = await import('./project-components');

describe('a main that lives on one frame and is followed by another', () => {
  it('is listed once, on the frame that owns it', async () => {
    const [canvas] = await listProjectComponents({} as Db, { orgId: 'o', projectId: 'p' });

    expect(canvas.components.map((c) => [c.frameId, c.frameName, c.variants[0].compId])).toEqual([['sheet', 'Components', compId]]);
  });
});
