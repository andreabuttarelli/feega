import { describe, expect, it } from 'vitest';
import { outlinePaths } from './outline-view';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { setClipFlags } from './organize';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = { component: 'Shape' as const, from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5 } };
const text = { component: 'Text' as const, from: 0, durationInFrames: 30, props: { text: 'hi' } };

describe('outline view', () => {
  it('a shape is drawn as its own outline in frame pixels', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), shape, 'box'));

    const [path] = outlinePaths(doc, 0, {});

    expect(path.id).toBe('box');
    expect(path.d.startsWith('M480 270')).toBe(true);
    expect(path.d.endsWith('Z')).toBe(true);
  });

  it('any other layer is the outline of its measured box', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), text, 'words'));

    expect(outlinePaths(doc, 0, { words: { left: 10, top: 20, width: 100, height: 50 } })).toEqual([{ id: 'words', d: 'M10 20L110 20L110 70L10 70Z' }]);
  });

  it('skips layers off the playhead, unmeasured or hidden', () => {
    const later = ok(addClip(newMotionDoc(MotionFormat.Landscape), { ...text, from: 60 }, 'later'));
    const hidden = ok(setClipFlags(ok(addClip(later, text, 'gone')), 'gone', { hidden: true }));

    expect(outlinePaths(hidden, 0, { later: { left: 0, top: 0, width: 1, height: 1 }, gone: { left: 0, top: 0, width: 1, height: 1 } })).toEqual([]);
  });
});
