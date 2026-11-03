import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { BoxKey, boxValue, layerBoxes, setLayerBox } from './layer-box';
import { MIXED } from './mixed';
import { EditMode } from './edit-mode';
import { createComponent } from './main-component';

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
