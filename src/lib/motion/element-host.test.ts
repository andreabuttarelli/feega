import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setKeyframes, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { Ease } from '@feega/motion-core/motion/design';
import { turnClips, QUARTER_TURN } from './layer-props';
import { wrapInStack } from './layout/ops';
import { HostLedger, Ratio, resizedSide, settleElement, sideOf, type HostBox } from './element-host';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const still = (width: number, height: number) => ({ ...newMotionDoc(MotionFormat.Landscape), still: { frame: 0 }, width, height }) as MotionDoc;

const rect = must(addClip(still(400, 240), { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, strokes: [{ paint: { type: 'solid', color: '#000000' }, width: 0.05 }] } }, 'r'));
const node: HostBox = { x: 10, y: 20, w: 200, h: 120, rotation: 0 };

const root = (doc: MotionDoc) => findClip(doc, 'r')!.clip as MotionClip;
const edited = (patch: Record<string, unknown>) => must(setProps(rect, 'r', patch));

describe('a free element settles into its node', () => {
  it('an element that fills its stage upright has nothing to settle', () => {
    expect(settleElement(rect, node)).toBeNull();
  });

  it('a root moved a quarter of the stage to the right moves the node, not the shape inside it', () => {
    const settled = settleElement(edited({ x: 0.75 }), node)!;

    expect(settled.box).toEqual({ x: 60, y: 20, w: 200, h: 120, rotation: 0 });
    expect(root(settled.doc).props).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1 });
    expect([settled.doc.width, settled.doc.height]).toEqual([400, 240]);
  });

  it('a root made 1.5 times wider widens the node and keeps its stroke the same on screen', () => {
    const settled = settleElement(edited({ width: 1.5 }), node)!;

    expect(settled.box).toEqual({ x: -40, y: 20, w: 300, h: 120, rotation: 0 });
    expect(root(settled.doc).props).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1 });
    expect([settled.doc.width, settled.doc.height]).toEqual([600, 240]);
    const [stroke] = root(settled.doc).props.strokes as { width: number }[];
    expect(stroke.width * Math.min(600, 240)).toBeCloseTo(0.05 * 240, 6);
  });

  it('a shorter text keeps its type the same size on screen', () => {
    const text = must(addClip(still(400, 240), { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.5, y: 0.5, width: 1, height: 1, size: 0.1 } }, 'r'));
    const settled = settleElement(must(setProps(text, 'r', { height: 0.5, y: 0.25 })), node)!;

    expect(settled.box).toMatchObject({ x: 10, y: 20, w: 200, h: 60 });
    expect(Number(root(settled.doc).props.size) * Math.min(settled.doc.width, settled.doc.height)).toBeCloseTo(24, 6);
  });

  it('a turn about the centre becomes the node turn and leaves the shape upright', () => {
    const settled = settleElement(must(setTransform(rect, 'r', { rotateZ: 30 })), node)!;

    expect(settled.box).toEqual({ ...node, rotation: 30 });
    expect(root(settled.doc).transform.rotateZ ?? 0).toBe(0);
  });

  it('a turn past half a turn wraps the node rotation into ±180°', () => {
    const settled = settleElement(must(setTransform(rect, 'r', { rotateZ: 30 })), { ...node, rotation: 170 })!;

    expect(settled.box.rotation).toBe(-160);
  });

  it('a free element turns about its centre whatever pivot its root was drawn with', () => {
    const cornered = must(setTransform(rect, 'r', { anchorX: 0, anchorY: 0, rotateZ: 90 }));

    expect(settleElement(cornered, node)!.box).toEqual({ ...node, rotation: 90 });
  });

  it('a move inside a turned node goes along the turned axis', () => {
    const settled = settleElement(edited({ x: 0.75 }), { ...node, rotation: 90 })!;

    expect(settled.box.x).toBeCloseTo(10, 6);
    expect(settled.box.y).toBeCloseTo(70, 6);
    expect(settled.box.rotation).toBe(90);
  });

  it('an animated root keeps its motion in the doc', () => {
    const animated = must(setKeyframes(edited({ x: 0.75 }), 'r', 'x', [{ frame: 0, value: 0.5, ease: Ease.Linear }, { frame: 10, value: 0.75, ease: Ease.Linear }]));

    expect(settleElement(animated, node)).toBeNull();
  });

  it('a doc with two roots is a group, not one element, and is left alone', () => {
    const two = must(addClip(edited({ x: 0.75 }), { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }, 's'));

    expect(settleElement(two, node)).toBeNull();
  });
});

describe('typing one side of a free element', () => {
  it('a typed width leaves the height alone', () => {
    expect(resizedSide(node, sideOf('width'), 300, Ratio.Free)).toEqual({ w: 300, h: 120 });
  });

  it('a typed height with the ratio locked scales the width along', () => {
    expect(resizedSide(node, sideOf('height'), 60, Ratio.Locked)).toEqual({ w: 100, h: 60 });
  });
});

describe('the node box rides along with the doc history', () => {
  it('stepping back to a doc puts the node where it was when that doc was left', () => {
    const ledger = new HostLedger();
    const wider = { ...node, w: 300 };
    ledger.leave(rect, node);

    expect(ledger.arrive(rect, wider)).toEqual(node);
  });

  it('a doc the node never moved away from leaves the node alone', () => {
    const ledger = new HostLedger();
    ledger.leave(rect, node);

    expect(ledger.arrive(rect, { ...node })).toBeNull();
    expect(ledger.arrive(edited({ x: 0.75 }), node)).toBeNull();
  });
});

describe('a free Stack settles its turn into its node', () => {
  const stack = (() => {
    const doc = still(400, 100);
    const texted = must(addClip(doc, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.25, y: 0.5, width: 0.5, height: 1 } }, 'a'));
    const two = must(addClip(texted, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.75, y: 0.5, width: 0.5, height: 1 } }, 'b'));
    return must(wrapInStack(two, ['a', 'b'], 'stack', 'lane'));
  })();
  const host: HostBox = { x: 0, y: 0, w: 400, h: 100, rotation: 0 };

  it('a fresh Stack has nothing to settle', () => {
    expect(settleElement(stack, host)).toBeNull();
  });

  it('a Stack turned 90° hands the turn to the node and stays upright in its own doc', () => {
    const settled = settleElement(must(turnClips(stack, ['stack'], QUARTER_TURN)), host)!;

    expect(settled.box.rotation).toBe(QUARTER_TURN);
    expect(findClip(settled.doc, 'stack')!.clip.transform.rotateZ ?? 0).toBe(0);
  });

  it('a turn a child takes inside the Stack stays with the child', () => {
    expect(settleElement(must(turnClips(stack, ['a'], QUARTER_TURN)), host)).toBeNull();
  });
});
