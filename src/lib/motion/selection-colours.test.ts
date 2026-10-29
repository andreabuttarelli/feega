import { describe, expect, it } from 'vitest';
import { documentColours, frameColours, isBrandToken, recolour, recolourFrame, selectionColours } from './selection-colours';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { precompose } from '@feega/motion-core/motion/precomp';

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

const hexesOf = (d: MotionDoc, ids: string[]) => selectionColours(d, ids).map((c) => c.colour).filter((c) => !isBrandToken(c));

describe('selection colours', () => {
  it('lists each colour of a mixed selection once', () => {
    expect(hexesOf(doc(), ['a', 'b', 't'])).toEqual(['#ff0000', '#000000', '#00ff00']);
    expect(selectionColours(doc(), ['a', 'b'])[0]).toEqual({ colour: '#ff0000', count: 2 });
  });

  it('recolours every use of one colour across the selection, and nothing else', () => {
    const next = ok(recolour(doc(), ['a', 'b', 't'], '#ff0000', '#0000ff'));

    expect(hexesOf(next, ['a', 'b', 't'])).toEqual(['#0000ff', '#000000', '#00ff00']);
    expect(findClip(next, 't')!.clip.props.color).toBe('#00ff00');
  });

  it('lists brand colour tokens beside hex colours', () => {
    let d = doc();
    d = ok(addClip(d, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'tok', color: 'brand.text' } }, 'k'));
    d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: 'brand.accent' }] } }, 's'));

    expect(selectionColours(d, ['k', 's']).map((c) => c.colour)).toEqual(expect.arrayContaining(['brand.text', 'brand.accent']));
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

describe('a new element', () => {
  it('lists only the colour it paints, not its unused defaults', () => {
    const d = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect' } }, 'r'));

    expect(selectionColours(d, ['r'])).toEqual([{ colour: '#d9d9d9', count: 1 }]);
    expect(documentColours(d)).toEqual(['#d9d9d9']);
  });
});

describe('frame colours', () => {
  const white = (d: MotionDoc, id: string) => ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'solid', color: '#FFFFFF' }] } }, id));

  function frame(): MotionDoc {
    let d = white(white(doc(), 'w1'), 'w2');
    d = ok(addClip(d, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: [{ type: 'linear-gradient', stops: [{ color: '#ffffff', pos: 0 }, { color: '#123456', pos: 1 }] }] } }, 'g'));
    return ok(precompose(d, ['w2'], { comp: 'nested', clip: 'n' }, 'Nested'));
  }

  const hexes = (d: MotionDoc) => frameColours(d).filter((c) => !isBrandToken(c.colour));

  it('lists every colour of the frame once, most used first, nested and gradient stops included', () => {
    expect(hexes(frame())).toEqual([
      { colour: '#ffffff', count: 3 },
      { colour: '#ff0000', count: 2 },
      { colour: '#000000', count: 1 },
      { colour: '#00ff00', count: 1 },
      { colour: '#123456', count: 1 }
    ]);
  });

  it('recolours every use of a colour across the frame in one doc, nested included', () => {
    const next = ok(recolourFrame(frame(), '#ffffff', '#000000'));

    expect(hexes(next)).toEqual([
      { colour: '#000000', count: 4 },
      { colour: '#ff0000', count: 2 },
      { colour: '#00ff00', count: 1 },
      { colour: '#123456', count: 1 }
    ]);
  });
});

describe('selection colours of a group', () => {
  it('reach into the group and recolour its children in one doc', () => {
    let d = doc();
    d = ok(precompose(d, ['a', 'b'], { comp: 'grp', clip: 'G' }, 'Group'));

    expect(hexesOf(d, ['G'])).toEqual(['#ff0000', '#000000']);
    const next = ok(recolour(d, ['G', 't'], '#ff0000', '#0000ff'));
    expect(hexesOf(next, ['G'])).toEqual(['#0000ff', '#000000']);
  });
});
