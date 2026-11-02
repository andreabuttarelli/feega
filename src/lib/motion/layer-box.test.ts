import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { BoxKey, boxValue, layerBoxes, setLayerBox } from './layer-box';
import { MIXED } from './mixed';
import { EditMode } from './edit-mode';

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
  it('reads one value where the layers agree and Mixed where they differ', () => {
    const placed = layerBoxes(two(), ['a', 'b'], 0);
    expect(boxValue(placed, BoxKey.Y)).not.toBe(MIXED);
    expect(boxValue(placed, BoxKey.X)).toBe(MIXED);
    expect(boxValue(placed, BoxKey.Width)).toBe(MIXED);
  });

  it('typing X moves every layer to that X', () => {
    const doc = two();
    const next = must(setLayerBox(doc, layerBoxes(doc, ['a', 'b'], 0), BoxKey.X, 100, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['a', 'b'], 0), BoxKey.X)).toBe(100);
  });

  it('typing W sets each layer width, heights untouched', () => {
    const doc = two();
    const next = must(setLayerBox(doc, layerBoxes(doc, ['a', 'b'], 0), BoxKey.Width, 50, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['a', 'b'], 0), BoxKey.Width)).toBe(50);
    expect(findClip(next, 'a')!.clip.props.height).toBe(RECT.height);
  });

  it('a layer with no box of its own, like an instance or an adjustment, scales to the width typed', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Adjustment', from: 0 }, 'p'));
    const next = must(setLayerBox(doc, layerBoxes(doc, ['p'], 0), BoxKey.Width, doc.width / 2, 0, EditMode.Design));
    expect(boxValue(layerBoxes(next, ['p'], 0), BoxKey.Width)).toBe(doc.width / 2);
  });
});
