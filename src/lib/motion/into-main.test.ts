import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { wrapInStack } from './layout/ops';
import { createComponent, instanceOf } from './main-component';
import { homedAt } from './canvas-components';
import { dropIntoMain, landInside, landedScene, mainUnder } from './into-main';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}${++n}`;
};

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);
const text = (doc: MotionDoc, id: string, x: number, y: number) => must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 90, props: { text: id, x, y, width: 0.1, height: 0.05 } }, id));

function card(): MotionDoc {
  const doc = text(newMotionDoc(MotionFormat.Landscape), 'title', 0.3, 0.3);
  const stacked = must(wrapInStack(doc, ['title'], 'card', 'lane'));
  return must(createComponent(stacked, ['card'], counter('m'), 'Card'));
}

describe('a layer added over a main lands inside it', () => {
  it('finds the main under a point', () => {
    const doc = card();

    expect(mainUnder(doc, [0.3 * doc.width, 0.3 * doc.height], 'here')).toBe('m2');
    expect(mainUnder(doc, [0.9 * doc.width, 0.9 * doc.height], 'here')).toBeNull();
  });

  it('never treats an instance as a place to add layers', () => {
    const doc = homedAt(card(), { m1: 'components' });

    expect(mainUnder(doc, [0.3 * doc.width, 0.3 * doc.height], 'screen')).toBeNull();
  });

  it('a text drawn over the main joins the stack inside it', () => {
    const doc = text(card(), 'subtitle', 0.255, 0.3);
    const landed = must(landInside(doc, 'subtitle', 'here'));
    const comp = instanceOf(landed, 'm2')!.comp;
    const inside = comp.tracks.flatMap((t) => t.clips as MotionClip[]);

    expect(clipsOf(landed).map((c) => c.id)).toEqual(['m2']);
    expect(inside.find((c) => c.id === 'subtitle')?.parent).toBe('card');
    expect(inside.find((c) => c.id === 'card')?.autoLayout?.order).toContain('subtitle');
  });

  it('keeps where it was drawn when the main has been moved', () => {
    const panel = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.8, height: 0.8 } }, 'bg'));
    const moved = must(setTransform(must(createComponent(panel, ['bg'], counter('f'), 'Panel')), 'f2', { x: 0.1 }));
    const landed = must(landInside(text(moved, 'badge', 0.75, 0.75), 'badge', 'here'));
    const badge = instanceOf(landed, 'f2')!.comp.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === 'badge');

    expect(badge?.props.x).toBeCloseTo(0.65, 6);
    expect(badge?.props.y).toBeCloseTo(0.75, 6);
  });

  it('a layer over a stack in a frame joins that stack', () => {
    const doc = text(must(wrapInStack(text(newMotionDoc(MotionFormat.Landscape), 'a', 0.3, 0.3), ['a'], 'row', 'lane')), 'b', 0.255, 0.3);
    const landed = must(landInside(doc, 'b', 'here'));

    expect(findClip(landed, 'b')!.clip.parent).toBe('row');
  });

  it('a layer over nothing stays where it is', () => {
    const doc = text(card(), 'free', 0.9, 0.9);

    expect(landInside(doc, 'free', 'here')).toEqual({ ok: true, doc });
  });

  it('names the landed layer by the scene id the canvas picks it with', () => {
    const doc = text(card(), 'subtitle', 0.255, 0.3);
    const landed = must(landInside(doc, 'subtitle', 'here'));

    expect(landedScene(landed, 'subtitle')).toBe('m2__0__subtitle');
    expect(landedScene(doc, 'subtitle')).toBe('subtitle');
  });

  it('a layer dropped on a main moves into it; dropped elsewhere, the drop is left alone', () => {
    const over = text(card(), 'subtitle', 0.255, 0.3);
    const away = text(card(), 'subtitle', 0.9, 0.9);

    expect(landedScene(must(dropIntoMain(over, 'subtitle', 'here')!), 'subtitle')).toBe('m2__0__subtitle');
    expect(dropIntoMain(away, 'subtitle', 'here')).toBeNull();
  });

  it('lands where the pointer was, even when the new layer reaches past the main', () => {
    const doc = text(card(), 'arrow', 0.9, 0.9);
    const landed = must(landInside(doc, 'arrow', 'here', [0.255 * doc.width, 0.3 * doc.height]));

    expect(landedScene(landed, 'arrow')).toBe('m2__0__arrow');
  });
});
