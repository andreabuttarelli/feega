import { describe, expect, it } from 'vitest';
import { copyStyle, pasteStyle } from './style-copy';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function doc(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Landscape);
  d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: '#ff0000' }], strokes: [{ paint: { type: 'solid', color: '#000000' } }] } }, 'red'));
  d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'ellipse' } }, 'plain'));
  return ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi', font: 'mono', weight: 700 } }, 'text'));
}

const clip = (d: MotionDoc, id: string) => findClip(d, id)!.clip;

describe('copy and paste properties', () => {
  it('gives another shape the fills and strokes, keeping what it is', () => {
    const d = doc();
    const pasted = ok(pasteStyle(d, ['plain'], copyStyle(clip(d, 'red'))));

    expect(clip(pasted, 'plain').props.fills).toEqual(clip(d, 'red').props.fills);
    expect(clip(pasted, 'plain').props.strokes).toEqual(clip(d, 'red').props.strokes);
    expect(clip(pasted, 'plain').props.shape).toBe('ellipse');
  });

  it('skips what the target has no place for', () => {
    const d = doc();
    const pasted = ok(pasteStyle(d, ['plain'], copyStyle(clip(d, 'text'))));

    expect(clip(pasted, 'plain').props.font).toBeUndefined();
    expect(ok(pasteStyle(d, ['text'], copyStyle(clip(d, 'text'))))).toBeTruthy();
  });

  it('carries the type style between texts', () => {
    let d = doc();
    d = ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'yo' } }, 'other'));
    const pasted = ok(pasteStyle(d, ['other'], copyStyle(clip(d, 'text'))));

    expect(clip(pasted, 'other').props).toMatchObject({ text: 'yo', font: 'mono', weight: 700 });
  });
});
