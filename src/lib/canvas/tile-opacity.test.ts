import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { tileFaded } from './tile-opacity';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const opacityOf = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)?.transform.opacity;

function grouped(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Parent' } }, 'p'));
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Child' } }, 'c'));
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Other' } }, 'o'));
  return { ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'c' ? { ...c, parent: 'p' } : c)) })) };
}

describe('l’opacità di una tile selezionata sulla tela', () => {
  it('va sui livelli di primo piano, non sui figli che già la ereditano', () => {
    const faded = must(tileFaded(grouped(), 0.5));

    expect(opacityOf(faded, 'p')).toBe(0.5);
    expect(opacityOf(faded, 'o')).toBe(0.5);
    expect(opacityOf(faded, 'c')).not.toBe(0.5);
  });

  it('una tile vuota resta com’è', () => {
    const empty = newMotionDoc(MotionFormat.Square);

    expect(must(tileFaded(empty, 0.3))).toEqual(empty);
  });
});
