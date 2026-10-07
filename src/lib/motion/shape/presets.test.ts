import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { ModifierKind } from './modifiers';
import { morphHere } from './ops';
import { SHAPE_PRESETS, ShapePreset, applyShapePreset } from './presets';
import { ShapeKind, type Modifier } from './schema';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const START = 30;
const LENGTH = 90;
const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: START, durationInFrames: LENGTH, props: { shape: 'circle' } }, 's'));
const clip = (d: MotionDoc) => findClip(d, 's')!.clip;
const kinds = (d: MotionDoc) => (clip(d).props.modifiers as Modifier[]).map((m) => m.kind);
const ids = () => {
  let n = 0;
  return () => `m${++n}`;
};

describe('liquid shape presets', () => {
  it('blob gives the shape an organic morph that runs by itself', () => {
    expect(kinds(must(applyShapePreset(doc, 's', ShapePreset.Blob, ids())))).toEqual([ModifierKind.Blob]);
  });

  it('ripple makes the edge wave', () => {
    expect(kinds(must(applyShapePreset(doc, 's', ShapePreset.Ripple, ids())))).toEqual([ModifierKind.Wave]);
  });

  it('liquid splits the blob in drops that drift apart and melt back together', () => {
    const liquid = must(applyShapePreset(doc, 's', ShapePreset.Liquid, ids()));
    const spread = clip(liquid).keyframes['mod.m2.offsetX'];

    expect(kinds(liquid)).toEqual([ModifierKind.Blob, ModifierKind.Repeater, ModifierKind.Goo]);
    expect(spread.map((k) => k.frame)).toEqual([0, LENGTH / 2, LENGTH - 1]);
    expect(spread[1].value).toBeGreaterThan(Number(spread[0].value));
  });

  it('a preset replaces the modifiers of the shape and their keys, and only Shapes take one', () => {
    const twice = must(applyShapePreset(must(applyShapePreset(doc, 's', ShapePreset.Liquid, ids())), 's', ShapePreset.Blob, ids()));
    const text = must(addClip(doc, { component: 'Title', from: 0, durationInFrames: 30 }, 't'));

    expect(kinds(twice)).toEqual([ModifierKind.Blob]);
    expect(Object.keys(clip(twice).keyframes)).toEqual([]);
    expect(applyShapePreset(text, 't', ShapePreset.Blob, ids()).ok).toBe(false);
    expect(SHAPE_PRESETS).toEqual([ShapePreset.Blob, ShapePreset.Ripple, ShapePreset.Liquid]);
  });
});

describe('morph to a shape in one step', () => {
  it('adds the target and keys the morph from the playhead over one second', () => {
    const morphed = must(morphHere(doc, 's', ShapeKind.Rect, START + 15));

    expect(clip(morphed).props.morphs).toEqual(['M0 0L1 0L1 1L0 1Z']);
    expect(clip(morphed).keyframes.morph.map((k) => [k.frame, k.value])).toEqual([
      [15, 0],
      [45, 1]
    ]);
  });

  it('near the end of the clip the morph ends on its last frame', () => {
    const morphed = must(morphHere(doc, 's', ShapeKind.Rect, START + LENGTH - 10));

    expect(clip(morphed).keyframes.morph.map((k) => k.frame)).toEqual([LENGTH - 10, LENGTH - 1]);
  });
});
