import { describe, expect, it } from 'vitest';
import { everyClip, findClip, type MotionDoc } from '../doc';
import { CodeTarget, exportCode } from './index';
import { selected, selectionDoc } from './selection';
import { absoluteDoc, heroDoc } from './fixtures/small';

const idsOf = (doc: MotionDoc) => everyClip({ tracks: doc.tracks, comps: {} }).map((c) => c.id);

const boxOf = (doc: MotionDoc, id: string) => {
  const { x, y, width, height } = findClip(doc, id)!.clip.props as Record<string, number>;
  return { left: Math.round((x - width / 2) * doc.width), top: Math.round((y - height / 2) * doc.height), width: Math.round(width * doc.width), height: Math.round(height * doc.height) };
};

describe('selectionDoc', () => {
  it('returns the same doc for an empty selection', () => {
    const doc = absoluteDoc();
    expect(selectionDoc(doc, [])).toBe(doc);
  });

  it('keeps a top-level clip alone, moved to 0,0 and sized to it', () => {
    const out = selectionDoc(absoluteDoc(), ['badge']);
    expect(idsOf(out)).toEqual(['badge']);
    expect([out.width, out.height]).toEqual([160, 48]);
    expect(boxOf(out, 'badge')).toEqual({ left: 0, top: 0, width: 160, height: 48 });
  });

  it('keeps a nested child with its parent dropped', () => {
    const out = selectionDoc(heroDoc(), ['sub']);
    expect(idsOf(out)).toEqual(['sub']);
    expect(findClip(out, 'sub')!.clip.parent).toBeNull();
    expect(out.width).toBe(600);
  });

  it('spans the union box of two siblings', () => {
    const out = selectionDoc(absoluteDoc(), ['badge', 'caption']);
    expect(idsOf(out).sort()).toEqual(['badge', 'caption']);
    expect([out.width, out.height]).toEqual([720, 50]);
    expect(boxOf(out, 'caption').left).toBe(0);
    expect(boxOf(out, 'badge').left).toBe(560);
  });

  it('keeps only the ancestor when a child is selected too', () => {
    const out = selectionDoc(heroDoc(), ['hero', 'headline']);
    expect(findClip(out, 'hero')).not.toBeNull();
    expect(findClip(out, 'headline')!.clip.parent).toBe('hero');
    expect(findClip(out, 'page')).toBeNull();
  });
});

describe('selected', () => {
  it('names one layer after itself', () => {
    expect(selected(absoluteDoc(), ['badge'], 'Poster')).toMatchObject({ name: 'Badge', label: 'Badge' });
  });

  it('names several layers after the frame', () => {
    expect(selected(absoluteDoc(), ['badge', 'caption'], 'Poster').name).toBe('Poster Selection');
  });

  it('is the whole frame with no label for an empty selection', () => {
    const doc = absoluteDoc();
    expect(selected(doc, [], 'Poster')).toEqual({ doc, name: 'Poster', label: null });
  });
});

describe('the code of a selection', () => {
  const doc = absoluteDoc();
  const codeOf = (d: MotionDoc) => exportCode(d, { target: CodeTarget.Html }).files.map((f) => f.content).join('\n');

  it('leaves out the markup of the other layers', () => {
    expect(codeOf(doc)).toContain('Limited run');
    expect(codeOf(selectionDoc(doc, ['badge']))).not.toContain('Limited run');
  });
});
