import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setProps, type OpResult } from '../timeline';
import type { CatalogueFont } from './model';
import { replaceFont, setFont } from './ops';

const CATALOGUE: CatalogueFont[] = [
  { f: 'Inter', c: 'sans', w: [400, 700], i: 1 },
  { f: 'Bebas Neue', c: 'display', w: [400], i: 0 }
];

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function withInter(): MotionDoc {
  const one = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hello' } }, 'a'));
  const two = ok(addClip(one, { component: 'Title', from: 0, durationInFrames: 60 }, 'b'));
  const set = ok(setFont(ok(setFont(two, 'a', { family: 'Inter' }, CATALOGUE)), 'b', { family: 'Inter' }, CATALOGUE));
  return ok(setProps(set, 'a', { runs: [{ start: 0, end: 2, font: 'Inter' }] }));
}

describe('replaceFont', () => {
  it('swaps a family for another on every clip and styled range, and drops the old one', () => {
    const doc = ok(replaceFont(withInter(), 'Inter', 'Bebas Neue', CATALOGUE));

    expect(findClip(doc, 'a')!.clip.props.font).toBe('Bebas Neue');
    expect(findClip(doc, 'b')!.clip.props.font).toBe('Bebas Neue');
    expect((findClip(doc, 'a')!.clip.props.runs as { font?: string }[])[0].font).toBe('Bebas Neue');
    expect(doc.fonts.map((f) => f.family)).toEqual(['Bebas Neue']);
  });

  it('replaces a family the video no longer has', () => {
    const missing = { ...withInter(), fonts: [] };

    expect(findClip(ok(replaceFont(missing, 'Inter', 'sans', CATALOGUE)), 'a')!.clip.props.font).toBe('sans');
  });

  it('refuses a replacement it cannot find', () => {
    expect(replaceFont(withInter(), 'Inter', 'Nope Sans', CATALOGUE).ok).toBe(false);
  });
});
