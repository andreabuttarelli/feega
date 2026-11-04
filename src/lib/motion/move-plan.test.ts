import { describe, expect, it } from 'vitest';
import { findClip, newMotionDoc, MotionFormat, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { shownBox, withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { wrapInStack } from './layout/ops';
import { createComponent } from './main-component';
import { DropOn, guessedBoxes, liftElement } from './move-element';
import { landIn, planComponent, planFree } from './move-plan';
import { Place } from './layer-place';

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

describe('landing an element on a stack in another frame', () => {
  const shape = (x: number) => ({ component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.3, width: 0.1, height: 0.1 } }) as const;
  const target = (() => {
    let d = newMotionDoc(MotionFormat.Square);
    d = must(addClip(d, shape(0.1), 'a'));
    d = must(addClip(d, shape(0.25), 'b'));
    return must(wrapInStack(d, ['a', 'b'], 'row', 'lane-row'));
  })();
  const element = (() => {
    const lifted = liftElement(must(addClip(newMotionDoc(MotionFormat.Square), shape(0.8), 'moved')), 'moved');
    if (!lifted.ok) {
      throw new Error(lifted.error);
    }
    return lifted.element;
  })();
  const rowBox = guessedBoxes(withAutoLayout(target)).row;
  const landed = (at: { x: number; y: number }) => {
    const plan = landIn({ nodeId: 'to', doc: target }, element, { on: DropOn.Frame, nodeId: 'to', at }, newId);
    if (!plan.ok || plan.landing.on !== DropOn.Frame) {
      throw new Error('not landed');
    }
    return findClip(plan.landing.doc, plan.landing.clipId)?.clip;
  };

  it('joins the stack under the drop point', () => {
    const at = { x: (rowBox.left + rowBox.width - 1) / target.width, y: (rowBox.top + rowBox.height / 2) / target.height };

    expect(landed(at)?.parent).toBe('row');
  });

  it('stays free away from any stack', () => {
    expect(landed({ x: 0.8, y: 0.8 })?.parent ?? null).toBeNull();
  });

  it('joins it when the element was free on the canvas', () => {
    const free = must(addClip(newMotionDoc(MotionFormat.Square), { ...shape(0.5), props: { ...shape(0.5).props, y: 0.5 } }, 'own'));
    const stage = { width: 100, height: 100 };
    const at = { x: (rowBox.left + rowBox.width - 1) / target.width, y: (rowBox.top + rowBox.height / 2) / target.height };

    const plan = planFree({ nodeId: 'free', doc: free, stage }, { nodeId: 'to', doc: target, stage: { width: 1080, height: 1080 } }, { on: DropOn.Frame, nodeId: 'to', at }, newId);

    if (!plan.ok || plan.landing.on !== DropOn.Frame) {
      throw new Error('not landed');
    }
    expect(findClip(plan.landing.doc, plan.landing.clipId)?.clip.parent).toBe('row');
  });

  it('takes the slot a Layers drop names, wherever the point is', () => {
    const free = must(addClip(newMotionDoc(MotionFormat.Square), shape(0.5), 'own'));
    const stage = { width: 100, height: 100 };
    const dropOn = (slot: { target: string; place: Place }) => {
      const plan = planFree({ nodeId: 'free', doc: free, stage }, { nodeId: 'to', doc: target, stage: { width: 1080, height: 1080 } }, { on: DropOn.Frame, nodeId: 'to', at: { x: 0.9, y: 0.9 }, slot }, newId);
      if (!plan.ok || plan.landing.on !== DropOn.Frame) {
        throw new Error('not landed');
      }
      return { id: plan.landing.clipId, order: findClip(plan.landing.doc, 'row')?.clip.autoLayout?.order };
    };

    const first = dropOn({ target: 'a', place: Place.Above });
    expect(first.order).toEqual([first.id, 'a', 'b']);

    const last = dropOn({ target: 'row', place: Place.Into });
    expect(last.order).toEqual(['a', 'b', last.id]);
  });
});
