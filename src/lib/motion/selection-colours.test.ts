import { describe, expect, it } from 'vitest';
import { recolour, selectionColours } from './selection-colours';
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
  d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: '#FF0000' }], strokes: [{ paint: { type: 'solid', color: '#000000' } }] } }, 'a'));
  d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'ellipse', fills: [{ type: 'solid', color: '#ff0000' }] } }, 'b'));
  return ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi', color: '#00ff00' } }, 't'));
}

describe('selection colours', () => {
  it('lists each colour of a mixed selection once', () => {
    expect(selectionColours(doc(), ['a', 'b', 't'])).toEqual(['#ff0000', '#000000', '#00ff00']);
  });

  it('recolours every use of one colour across the selection, and nothing else', () => {
    const next = ok(recolour(doc(), ['a', 'b', 't'], '#ff0000', '#0000ff'));

    expect(selectionColours(next, ['a', 'b', 't'])).toEqual(['#0000ff', '#000000', '#00ff00']);
    expect(findClip(next, 't')!.clip.props.color).toBe('#00ff00');
  });
});
