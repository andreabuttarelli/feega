import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { DropOn } from '$lib/motion/move-element';
import { idsFrom, planCopy, planMove } from '$lib/motion/move-plan';
import { FrameKind } from './motion-node';
import { shownMove, snapOf } from './frame-moves';

function withText(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'move me' } }, 'txt');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const place = { id: 'new', canvasId: 'c', projectId: 'p' };
const ids = () => idsFrom(['k1', 'k2', 'k3', 'k4', 'k5', 'k6'], () => 'random');

describe('frame moves: what the canvas shows before the server answers', () => {
  it('reads a tile as a frame of its own width, the doc keeping its proportions', () => {
    const doc = withText();
    expect(snapOf({ id: 'a', type: 'motion', w: 400, data: { format: '16:9' } }, doc)).toEqual({ nodeId: 'a', doc, kind: FrameKind.Frame, stage: { width: 400, height: 225 } });
  });

  it('an element dragged onto the canvas becomes a new tile holding it, and the source loses it', () => {
    const source = snapOf({ id: 'a', type: 'motion', w: 400, data: { format: '16:9' } }, withText());
    const plan = planMove(source, null, { clipId: 'txt', drop: { on: DropOn.Canvas, x: 900, y: 40 } }, ids());

    const shown = shownMove(plan, place, 'a');

    expect(shown.made).toMatchObject({ id: 'new', canvasId: 'c', projectId: 'p', type: 'element', version: 0 });
    expect(shown.gone).toBeNull();
    expect(shown.docs.map((d) => [d.nodeId, d.doc.tracks.flatMap((t) => t.clips).length])).toEqual([
      ['new', 1],
      ['a', 0]
    ]);
  });

  it('a free element emptied by the move leaves the canvas', () => {
    const doc = withText();
    const source = snapOf({ id: 'a', type: 'motion', w: 200, data: { format: '16:9', kind: 'element' } }, doc);
    const target = snapOf({ id: 'b', type: 'motion', w: 400, data: { format: '16:9' } }, newMotionDoc(MotionFormat.Landscape));
    const plan = planMove(source, target, { clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } } }, ids());

    const shown = shownMove(plan, place, 'a');

    expect(shown).toMatchObject({ made: null, gone: 'a' });
    expect(shown.docs.map((d) => d.nodeId)).toEqual(['b']);
  });

  it('a copy shows only the landing; nothing it cannot plan is shown', () => {
    const source = snapOf({ id: 'a', type: 'motion', w: 400, data: { format: '16:9' } }, withText());
    const copied = shownMove(planCopy(source, null, { clipId: 'txt', drop: { on: DropOn.Canvas, x: 0, y: 0 } }, ids()), place, 'a');

    expect(copied.docs.map((d) => d.nodeId)).toEqual(['new']);
    expect(shownMove(null, place, 'a')).toEqual({ made: null, gone: null, docs: [] });
  });
});
