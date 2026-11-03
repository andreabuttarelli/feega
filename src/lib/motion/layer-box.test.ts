import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { BoxKey, boxValue, layerBoxes, setLayerBox } from './layer-box';
import { MIXED } from './mixed';
import { EditMode } from './edit-mode';
import { createComponent, instanceOf } from './main-component';
import { setConstraints, Horizontal, Vertical } from './constraints/constraints';
import { wrapInFrame, wrapInStack } from './layout/ops';
import { overridden } from '@feega/motion-core/motion/precomp';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const RECT = { shape: 'rect', x: 0.25, y: 0.25, width: 0.1, height: 0.1 };

function two(): MotionDoc {
  const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: RECT }, 'a'));
  return must(addClip(doc, { component: 'Shape', from: 0, props: { ...RECT, x: 0.75, width: 0.2 } }, 'b'));
}

describe('the box of each selected layer', () => {
  it('reads the bounds of the whole selection, as Figma does, never Mixed', () => {
    const doc = two();
    const placed = layerBoxes(doc, ['a', 'b'], 0);
    const [a, b] = placed.map((p) => p.bounds);
    expect(boxValue(placed, BoxKey.X)).toBe(Math.round(a.left * 100) / 100);
    expect(boxValue(placed, BoxKey.Width)).toBe(Math.round((b.right - a.left) * 100) / 100);
    expect(boxValue(placed, BoxKey.Y)).not.toBe(MIXED);
  });

  it('typing X moves the selection so its left edge lands there, keeping the gap between layers', () => {
    const doc = two();
    const before = layerBoxes(doc, ['a', 'b'], 0).map((p) => p.bounds.left);
    const next = must(setLayerBox(doc, layerBoxes(doc, ['a', 'b'], 0), BoxKey.X, 100, 0, EditMode.Design));
    const after = layerBoxes(next, ['a', 'b'], 0).map((p) => p.bounds.left);
    expect(boxValue(layerBoxes(next, ['a', 'b'], 0), BoxKey.X)).toBe(100);
    expect(Math.round(after[1] - after[0])).toBe(Math.round(before[1] - before[0]));
  });

  it('typing W stretches the selection to that width', () => {
    const doc = two();
    const next = must(setLayerBox(doc, layerBoxes(doc, ['a', 'b'], 0), BoxKey.Width, 600, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['a', 'b'], 0), BoxKey.Width)).toBe(600);
    expect(boxValue(layerBoxes(next, ['a', 'b'], 0), BoxKey.X)).toBe(boxValue(layerBoxes(doc, ['a', 'b'], 0), BoxKey.X));
  });

  it('typing W on one layer sets its width, height untouched', () => {
    const doc = two();
    const next = must(setLayerBox(doc, layerBoxes(doc, ['a'], 0), BoxKey.Width, 50, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['a'], 0), BoxKey.Width)).toBe(50);
    expect(findClip(next, 'a')!.clip.props.height).toBe(RECT.height);
  });

  it('a layer with no box of its own, like an instance or an adjustment, scales to the width typed', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Adjustment', from: 0 }, 'p'));
    const next = must(setLayerBox(doc, layerBoxes(doc, ['p'], 0), BoxKey.Width, doc.width / 2, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['p'], 0), BoxKey.Width)).toBe(doc.width / 2);
  });
});

describe('the box of an instance', () => {
  const made = () => {
    let n = 0;
    const doc = must(createComponent(two(), ['a'], () => `i${++n}`, 'Chip'));
    return { doc, id: 'i2' };
  };

  it('reads the box of what the instance shows, not the whole frame', () => {
    const { doc, id } = made();
    const [box] = layerBoxes(doc, [id], 0);
    const width = doc.width * RECT.width;

    expect(box.bounds.right - box.bounds.left).toBeCloseTo(width, 3);
    expect(box.bounds.left).toBeCloseTo(doc.width * (RECT.x - RECT.width / 2), 3);
  });

  it('typing W resizes what the instance shows', () => {
    const { doc, id } = made();
    const next = must(setLayerBox(doc, layerBoxes(doc, [id], 0), BoxKey.Width, 400, 0, EditMode.Design));

    expect(boxValue(layerBoxes(next, [id], 0), BoxKey.Width)).toBe(400);
  });

  it('typing X moves the instance there', () => {
    const { doc, id } = made();
    const next = must(setLayerBox(doc, layerBoxes(doc, [id], 0), BoxKey.X, 100, 0, EditMode.Design));

    expect(boxValue(layerBoxes(next, [id], 0), BoxKey.X)).toBe(100);
  });
});

describe('typing W or H on an instance resizes it like a frame, never scales it', () => {
  const framedCard = () => {
    const shapes = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { ...RECT, x: 0.2, y: 0.2, width: 0.04, height: 0.04 } }, 'icon')), { component: 'Shape', from: 0, props: { ...RECT, x: 0.25, y: 0.3, width: 0.14, height: 0.02 } }, 'bar'));
    const pinned = must(setConstraints(must(setConstraints(shapes, ['icon'], { horizontal: Horizontal.Left, vertical: Vertical.Top })), ['bar'], { horizontal: Horizontal.LeftRight, vertical: Vertical.Top }));
    const framed = must(wrapInFrame(pinned, ['icon', 'bar'], 'panel', 'lane'));
    let n = 0;
    return must(createComponent(framed, ['panel'], () => `c${++n}`, 'Card'));
  };
  const shownClip = (doc: MotionDoc, id: string) => {
    const instance = instanceOf(doc, 'c2')!;
    return overridden(instance.comp.tracks, instance.clip, instance.comp.component).flatMap((t) => t.clips).find((c) => c.id === id)!;
  };
  const px = (doc: MotionDoc, id: string) => Number(shownClip(doc, id).props.width) * doc.width;

  it('the instance takes the typed width', () => {
    const doc = framedCard();
    const next = must(setLayerBox(doc, layerBoxes(doc, ['c2'], 0), BoxKey.Width, 600, 0, EditMode.Design));

    expect(boxValue(layerBoxes(next, ['c2'], 0), BoxKey.Width)).toBeCloseTo(600, 0);
  });

  it('a child pinned left keeps its size, a child pinned left and right stretches', () => {
    const doc = framedCard();
    const was = boxValue(layerBoxes(doc, ['c2'], 0), BoxKey.Width) as number;
    const next = must(setLayerBox(doc, layerBoxes(doc, ['c2'], 0), BoxKey.Width, 600, 0, EditMode.Design));

    expect(px(next, 'icon')).toBeCloseTo(px(doc, 'icon'), 3);
    expect(px(next, 'bar')).toBeCloseTo(px(doc, 'bar') + 600 - was, 3);
    expect(findClip(next, 'c2')!.clip.transform.scale ?? 1).toBe(1);
  });

  it('an auto layout instance grows its stack, its text keeps its size', () => {
    const text = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props: { text: 'Buy', x: 0.3, y: 0.3, width: 0.1, height: 0.05 } }, 'label'));
    let n = 0;
    const doc = must(createComponent(must(wrapInStack(text, ['label'], 'pill', 'lane')), ['pill'], () => `c${++n}`, 'Pill'));
    const height = boxValue(layerBoxes(doc, ['c2'], 0), BoxKey.Height);

    const next = must(setLayerBox(doc, layerBoxes(doc, ['c2'], 0), BoxKey.Width, 500, 0, EditMode.Design));

    expect(boxValue(layerBoxes(next, ['c2'], 0), BoxKey.Width)).toBeCloseTo(500, 0);
    expect(boxValue(layerBoxes(next, ['c2'], 0), BoxKey.Height)).toBe(height);
  });
});
