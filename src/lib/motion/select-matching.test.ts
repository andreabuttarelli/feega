import { describe, expect, it } from 'vitest';
import { Same, matchingLayers, sameLayers } from './select-matching';
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

describe('select same', () => {
  const painted = (fill: string, stroke: string | null) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: fill }], strokes: stroke ? [{ paint: { type: 'solid', color: stroke } }] : [] } });

  function painting(): MotionDoc {
    let doc = newMotionDoc(MotionFormat.Landscape);
    doc = ok(addClip(doc, painted('#ff0000', '#000000'), 'a'));
    doc = ok(addClip(doc, painted('#ff0000', null), 'b'));
    doc = ok(addClip(doc, painted('#00ff00', '#000000'), 'c'));
    doc = ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi', font: 'mono' } }, 't'));
    doc = ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'yo', font: 'sans' } }, 'u'));
    return ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'ok', font: 'mono' } }, 'v'));
  }

  it('picks every layer sharing the fill, the stroke or the font of the selection', () => {
    expect(sameLayers(painting(), ['a'], Same.Fill).sort()).toEqual(['a', 'b']);
    expect(sameLayers(painting(), ['a'], Same.Stroke).sort()).toEqual(['a', 'c']);
    expect(sameLayers(painting(), ['t'], Same.Font).sort()).toEqual(['t', 'v']);
  });

  it('a layer without the property matches nothing', () => {
    expect(sameLayers(painting(), ['b'], Same.Stroke)).toEqual([]);
    expect(sameLayers(painting(), ['a'], Same.Effect)).toEqual([]);
  });
});
