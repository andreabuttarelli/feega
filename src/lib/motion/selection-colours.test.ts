import { describe, expect, it } from 'vitest';
import { documentColours, isBrandToken, recolour, selectionColours } from './selection-colours';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';

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

const hexesOf = (d: MotionDoc, ids: string[]) => selectionColours(d, ids).filter((c) => !isBrandToken(c));

describe('selection colours', () => {
  it('lists each colour of a mixed selection once', () => {
    expect(hexesOf(doc(), ['a', 'b', 't'])).toEqual(['#ff0000', '#000000', '#00ff00']);
  });

  it('recolours every use of one colour across the selection, and nothing else', () => {
    const next = ok(recolour(doc(), ['a', 'b', 't'], '#ff0000', '#0000ff'));

    expect(hexesOf(next, ['a', 'b', 't'])).toEqual(['#0000ff', '#000000', '#00ff00']);
    expect(findClip(next, 't')!.clip.props.color).toBe('#00ff00');
  });

  it('lists brand colour tokens beside hex colours', () => {
    let d = doc();
    d = ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'tok', color: 'brand.text', fills: [{ type: 'solid', color: 'brand.accent' }] } }, 'k'));

    expect(selectionColours(d, ['k'])).toEqual(expect.arrayContaining(['brand.text', 'brand.accent']));
  });

  it('recolours a token to another token and keeps it a token binding', () => {
    let d = doc();
    d = ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'tok', color: 'brand.text' } }, 'k'));

    const next = ok(recolour(d, ['k', 't'], 'brand.text', 'brand.accent'));

    expect(findClip(next, 'k')!.clip.props.color).toBe('brand.accent');
    expect(findClip(next, 't')!.clip.props.color).toBe('#00ff00');
  });

  it('leaves a token alone when a hex colour is recoloured', () => {
    let d = doc();
    d = ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'tok', color: 'brand.text', fills: [{ type: 'solid', color: '#ff0000' }] } }, 'k'));

    const next = ok(recolour(d, ['k'], '#ff0000', '#0000ff'));

    expect(findClip(next, 'k')!.clip.props.color).toBe('brand.text');
  });

  it('lists the solid colours of the whole document, most used first, without alpha or tokens', () => {
    const d = ok(addClip(doc(), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: '#FF000080' }] } }, 'u'));

    expect(documentColours(d)).toEqual(['#ff0000', '#000000', '#00ff00']);
  });
});
