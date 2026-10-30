import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { createComponent } from '$lib/motion/main-component';
import { setMainOf } from '$lib/motion/component-set';
import type { FrameStore, StoredFrame } from '$lib/server/motion/move-element';
import { belowAll, homeComponents } from './components-page';

function storeWith(doc: MotionDoc) {
  const frames = new Map<string, StoredFrame>([['page', { nodeId: 'page', projectId: 'p', canvasId: 'design', version: 1, doc }]]);
  const store = {
    read: vi.fn(async (id: string) => frames.get(id) ?? null),
    create: vi.fn(async (at: { canvasId: string }, made: MotionDoc) => {
      const id = `set-${frames.size}`;
      frames.set(id, { nodeId: id, projectId: 'p', canvasId: at.canvasId, version: 1, doc: made });
      return id;
    }),
    write: vi.fn(async (id: string, version: number, next: MotionDoc) => {
      frames.set(id, { ...frames.get(id)!, doc: next, version: version + 1 });
      return { outcome: 'written' };
    })
  } as unknown as FrameStore;
  return { store, frames };
}

const PAGE = async () => ({ place: { projectId: 'p', canvasId: 'components' }, at: { x: 0, y: 0 } });

let n = 0;
const newId = () => `h${++n}`;

function designWithButton(): MotionDoc {
  const base = addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 1440, height: 900 }, { component: 'Shape', from: 0, durationInFrames: 30, props: { x: 0.5, y: 0.5, width: 0.1, height: 0.05 } }, 'pill');
  const made = base.ok ? createComponent(base.doc, ['pill'], newId, 'Button') : base;
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

describe('a component made by hand moves its main to the Components page', () => {
  it('leaves a linked instance in place and puts the main in its own set frame', async () => {
    const doc = designWithButton();
    const compId = String((doc.tracks.flatMap((t) => t.clips)[0] as MotionClip).props.comp);
    const { store, frames } = storeWith(doc);

    const done = await homeComponents(store, PAGE, 'page', newId);
    const [setId] = done.setIds;

    expect(done.moved).toEqual([compId]);
    expect(frames.get(setId)!.canvasId).toBe('components');
    expect(setMainOf(frames.get(setId)!.doc)).toBe(compId);
    expect(frames.get('page')!.doc.comps[compId].component!.home).toBe(setId);
  });

  it('does nothing for a frame already on the Components page', async () => {
    const { store } = storeWith(designWithButton());

    expect(await homeComponents(store, async () => ({ place: { projectId: 'p', canvasId: 'design' }, at: { x: 0, y: 0 } }), 'page', newId)).toEqual({ moved: [], setIds: [] });
  });
});


describe('new mains land below what the Components page already holds', () => {
  it('starts at the origin on an empty page', () => {
    expect(belowAll([])).toEqual({ x: 0, y: 0 });
  });

  it('goes under the lowest node, aligned to the leftmost', () => {
    const nodes = [
      { position: { x: 100, y: 0, z: 0 }, size: { width: 200, height: 300 } },
      { position: { x: -50, y: 400, z: 0 }, size: { width: 200, height: 100 } }
    ];
    expect(belowAll(nodes)).toEqual({ x: -50, y: 740 });
  });
});
