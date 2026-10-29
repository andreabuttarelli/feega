// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { groupClips } from '$lib/motion/group';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { withSurface } from '@feega/motion-core/motion/surface';
import { framePicker } from './frame-pick';
import { Reach, childBelow } from './frame-select';
import { parentPick, pickTarget, reachOf } from './frame-scope';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = (doc: MotionDoc, id: string, x: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x, y: 0.5, width: 0.05, height: 0.05 } }, id));

const rootIds = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).map((c) => c.id);

function nested() {
  let n = 0;
  const id = () => `g${++n}`;
  let doc = shape(shape(shape(shape(newMotionDoc(MotionFormat.Landscape), 'text', 0.2), 'label', 0.3), 'other', 0.6), 'free', 0.9);
  doc = must(groupClips(doc, ['text', 'label'], id));
  const card = rootIds(doc).find((c) => c !== 'other' && c !== 'free')!;
  doc = must(groupClips(doc, [card, 'other'], id));
  const section = rootIds(doc).find((c) => c !== 'free')!;
  const inSection = (s: string) => `${section}__0__${s}`;
  const inCard = (s: string) => inSection(`${card}__0__${s}`);
  return { doc, section, card: inSection(card), other: inSection('other'), text: inCard('text'), label: inCard('label') };
}

describe('pickTarget', () => {
  const t = nested();
  const overText = [t.section, t.card, t.text];
  const overLabel = [t.section, t.card, t.label];
  const overOther = [t.section, t.other];
  const overFree = ['free'];

  const cases: [string, string[], string[], Reach, string | null][] = [
    ['nothing picked: the frame child', overText, [], Reach.Top, t.section],
    ['nothing picked, deep: the deepest element', overText, [], Reach.Deep, t.text],
    ['section picked: still the section', overText, [t.section], Reach.Top, t.section],
    ['inside section: the card under the pointer', overText, [t.other], Reach.Top, t.card],
    ['inside section: the sibling', overOther, [t.card], Reach.Top, t.other],
    ['inside card: the sibling text', overLabel, [t.text], Reach.Top, t.label],
    ['inside card, pointer on a section sibling: one context up', overOther, [t.text], Reach.Top, t.other],
    ['inside card, pointer outside the section: the frame child', overFree, [t.text], Reach.Top, 'free'],
    ['inside card, deep: the deepest element', overOther, [t.text], Reach.Deep, t.other],
    ['over bare frame: nothing', [], [t.text], Reach.Top, null]
  ];

  it.each(cases)('%s', (_name, chain, picks, reach, expected) => {
    expect(pickTarget(t.doc, chain, picks, reach)).toBe(expected);
  });
});

function ledgerline(): MotionDoc {
  const parsed = parseMotionDoc(landingDoc());
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return withSurface(parsed.doc, 'surface');
}

describe('a frame whose only layer is a full-frame page', () => {
  const doc = ledgerline();
  const picker = framePicker({ doc, tokens: FEEGA_TOKENS, assets: {} });
  const size = picker.frameSize();
  const space = picker.spaceOf({ x: 0, y: 0, w: size.width, h: size.height }, 0);
  const at = (x: number, y: number) => picker.chain(space.pointToWorld([x, y]), space);

  it.each([
    ['the nav', 300, 36, 'nav'],
    ['the hero', 720, 400, 'hero'],
    ['the footer', 1430, 4400, 'footer']
  ])('a click over %s picks it, not the page that fills the frame', (_name, x, y, expected) => {
    expect(pickTarget(doc, at(x, y), [], Reach.Top)).toBe(expected);
  });

  it('a click on the page itself picks nothing: the frame is selected', () => {
    expect(pickTarget(doc, ['page'], [], Reach.Top)).toBeNull();
  });

  it('a click inside a picked section picks its sibling at the same level', () => {
    expect(pickTarget(doc, at(300, 36), ['hero'], Reach.Top)).toBe('nav');
  });

  it('a double click descends one level, to the child of the pick under the pointer', () => {
    expect(childBelow(doc, 'hero-secondary', ['hero'])).toBe('hero-actions');
    expect(childBelow(doc, 'hero-secondary', ['hero-actions'])).toBe('hero-secondary');
    expect(childBelow(doc, 'hero-secondary', ['nav'])).toBeNull();
  });

  it('Esc climbs to the container, and from a section to the frame', () => {
    expect(parentPick(doc, 'hero-actions')).toBe('hero');
    expect(parentPick(doc, 'hero')).toBeNull();
  });
});

describe('reachOf', () => {
  it.each([
    [{ metaKey: true, ctrlKey: false }, Reach.Deep],
    [{ metaKey: false, ctrlKey: true }, Reach.Deep],
    [{ metaKey: false, ctrlKey: false }, Reach.Top]
  ])('%o reaches %s', (keys, reach) => {
    expect(reachOf(keys)).toBe(reach);
  });
});
