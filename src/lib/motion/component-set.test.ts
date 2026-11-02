import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from './main-component';
import { compBox } from './comp-frame';
import { SET_GAP_PX, addSetVariant, resizeSetMain, setMainOf } from './component-set';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `s${++n}`;

function setFrame(): MotionDoc {
  const base = must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 280, height: 124 }, { component: 'Shape', from: 0, durationInFrames: 30, props: { x: 0.5, y: 0.5, width: 200 / 280, height: 44 / 124 } }, 'pill'));
  return must(createComponent(base, ['pill'], newId, 'Button'));
}

const precomps = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Precomp');

describe('a frame on the Components page that holds one set', () => {
  it('is told apart from a frame that also holds other elements', () => {
    const doc = setFrame();
    const extra = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 'loose'));

    expect(setMainOf(doc)).toBe(String(precomps(doc)[0].props.comp));
    expect(setMainOf(extra)).toBeNull();
    expect(setMainOf(newMotionDoc(MotionFormat.Landscape))).toBeNull();
  });

  it('grows to the right by one main and shows the new variant there', () => {
    const doc = setFrame();
    const grown = must(addSetVariant(doc, newId));
    const [first, second] = precomps(grown).map((c) => compBox(grown.comps[String(c.props.comp)], grown)!);

    expect(precomps(grown)).toHaveLength(2);
    expect(grown.width).toBe(280 + 200 + SET_GAP_PX);
    expect(grown.height).toBe(124);
    expect(Math.round(second.left - first.right)).toBe(SET_GAP_PX);
    expect(Math.round(second.right - second.left)).toBe(200);
  });
});

describe('resizing the main of a set', () => {
  it('gives the main the size asked, moves the variants after it and hugs the set', () => {
    const doc = must(addSetVariant(setFrame(), newId));
    const [main] = precomps(doc);

    const resized = must(resizeSetMain(doc, main.id, { width: 240, height: 64 }));
    const [first, second] = precomps(resized).map((c) => compBox(resized.comps[String(c.props.comp)], resized)!);

    expect(Math.round(first.right - first.left)).toBe(240);
    expect(Math.round(first.bottom - first.top)).toBe(64);
    expect(Math.round(second.left - first.right)).toBe(SET_GAP_PX);
    expect(Math.round(second.right - second.left)).toBe(200);
    expect(resized.width).toBe(doc.width + 40);
    expect(resized.height).toBe(doc.height + 20);
  });

  it('refuses a clip that is not a main of the set', () => {
    expect(resizeSetMain(setFrame(), 'nope', { width: 10, height: 10 }).ok).toBe(false);
  });
});
