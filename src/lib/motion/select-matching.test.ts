import { describe, expect, it } from 'vitest';
import { Match, matchingLayers } from './select-matching';
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

describe('select layers with the same style', () => {
  function styled(): MotionDoc {
    let doc = newMotionDoc(MotionFormat.Landscape);
    doc = ok(addClip(doc, { ...shape('rect'), props: { shape: 'rect', fills: [{ type: 'solid', color: '#ff0000' }] } }, 'red'));
    doc = ok(addClip(doc, { ...shape('ellipse'), props: { shape: 'ellipse', fills: [{ type: 'solid', color: '#ff0000' }] } }, 'redCircle'));
    doc = ok(addClip(doc, { ...shape('rect'), props: { shape: 'rect', fills: [{ type: 'solid', color: '#0000ff' }] } }, 'blue'));
    doc = ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a', font: 'mono', weight: 700, size: 0.1 } }, 'serifA'));
    return ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'b', font: 'mono', weight: 700, size: 0.1 } }, 'serifB'));
  }

  it('the same fill, whatever the kind of layer', () => {
    expect(matchingLayers(styled(), ['red'], Match.Fill).sort()).toEqual(['red', 'redCircle']);
  });

  it('the same font, weight and size', () => {
    expect(matchingLayers(styled(), ['serifA'], Match.Font).sort()).toEqual(['serifA', 'serifB']);
  });

  it('the same stroke: two shapes without one match each other', () => {
    expect(matchingLayers(styled(), ['red'], Match.Stroke)).toContain('blue');
  });
});
