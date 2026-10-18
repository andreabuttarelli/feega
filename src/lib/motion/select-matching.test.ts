import { describe, expect, it } from 'vitest';
import { matchingLayers } from './select-matching';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (kind: string) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: kind } });

function mixed(): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  doc = ok(addClip(doc, shape('rect'), 'r1'));
  doc = ok(addClip(doc, shape('ellipse'), 'e1'));
  doc = ok(addClip(doc, shape('rect'), 'r2'));
  return ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 't1'));
}

describe('select matching layers', () => {
  it('picks every layer of the same kind as the selection', () => {
    expect(matchingLayers(mixed(), ['r1']).sort()).toEqual(['r1', 'r2']);
  });

  it('unions the kinds of a mixed selection', () => {
    expect(matchingLayers(mixed(), ['e1', 't1']).sort()).toEqual(['e1', 't1']);
  });

  it('keeps the selection when nothing is selected', () => {
    expect(matchingLayers(mixed(), [])).toEqual([]);
  });
});
