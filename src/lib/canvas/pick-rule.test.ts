import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { groupClips } from '$lib/motion/group';
import { Reach } from './frame-select';
import { pickTarget, reachOf } from './frame-scope';

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

describe('reachOf', () => {
  it.each([
    [{ metaKey: true, ctrlKey: false }, Reach.Deep],
    [{ metaKey: false, ctrlKey: true }, Reach.Deep],
    [{ metaKey: false, ctrlKey: false }, Reach.Top]
  ])('%o reaches %s', (keys, reach) => {
    expect(reachOf(keys)).toBe(reach);
  });
});
