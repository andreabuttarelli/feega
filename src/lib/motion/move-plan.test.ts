import { describe, expect, it } from 'vitest';
import { newMotionDoc, MotionFormat, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { shownBox } from '@feega/motion-core/motion/layout/resolve';
import { createComponent } from './main-component';
import { DropOn } from './move-element';
import { planComponent } from './move-plan';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

let n = 0;
const newId = () => `id-${++n}`;

function tallSet(): { doc: MotionDoc; compId: string } {
  const sheet = { ...newMotionDoc(MotionFormat.Landscape), width: 1080, height: 8000 };
  const backed = must(addClip(sheet, { component: 'Shape', from: 0, durationInFrames: 90, props: { x: 0.5, y: 0.5, width: 1, height: 1 } }, 'set-background'));
  const base = must(addClip(backed, { component: 'Shape', from: 0, durationInFrames: 90, props: { x: 0.5, y: 0.05, width: 0.2, height: 0.01 } }, 'pill'));
  const doc = must(createComponent(base, ['pill'], newId, 'Button'));
  return { doc, compId: String(doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.props.comp) };
}

describe('placing a component on the canvas', () => {
  it('hugs the instance, not the tall set frame it lives in', () => {
    const { doc, compId } = tallSet();

    const plan = planComponent({ nodeId: 'set', doc, stage: { width: 1080, height: 8000 } }, compId, { on: DropOn.Canvas, x: 500, y: 300 }, newId);

    if (!plan.ok || plan.landing.on !== DropOn.Canvas) {
      throw new Error('not placed on the canvas');
    }
    const { shape, at, doc: placed, clipId } = plan.landing;
    expect([Math.round(shape.width), Math.round(shape.height)]).toEqual([216, 80]);
    expect(at).toEqual({ x: 500 - shape.width / 2, y: 300 - shape.height / 2 });
    const box = shownBox(placed, clipId)!;
    expect([box.left, box.top, box.width / placed.width, box.height / placed.height].map((v) => Math.round(v * 100) / 100)).toEqual([0, 0, 1, 1]);
  });
});
