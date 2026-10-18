import { describe, expect, it } from 'vitest';
import { reformat } from './reformat';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { DEFAULT_AUTO_LAYOUT } from './layout/model';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function landscape(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Landscape);
  const withBackdrop = ok(addClip(base, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'backdrop'));
  const withCard = ok(addClip(withBackdrop, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.75, y: 0.5, width: 0.25, height: 0.5 } }, 'card'));
  return ok(addClip(withCard, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi', x: 0.25, y: 0.5, width: 0.3, height: 0.2, size: 0.1 } }, 'title'));
}

const props = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip.props as Record<string, number>;

describe('a frame in another format', () => {
  const vertical = ok(reformat(landscape(), { format: MotionFormat.Vertical }));

  it('takes the new size', () => {
    expect([vertical.width, vertical.height]).toEqual([1080, 1920]);
  });

  it('keeps a full-bleed layer covering the frame', () => {
    expect(props(vertical, 'backdrop')).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1 });
  });

  it('scales the rest uniformly to fit, around the centre, so nothing stretches', () => {
    const card = props(vertical, 'card');
    const pxWidth = card.width * 1080;
    const pxHeight = card.height * 1920;
    expect(pxWidth / pxHeight).toBeCloseTo((0.25 * 1920) / (0.5 * 1080), 5);
    expect(card.x).toBeCloseTo(0.5 + 0.25 * ((1920 * 0.5625) / 1080), 5);
    expect(card.y).toBeCloseTo(0.5, 5);
  });

  it('scales text with its box', () => {
    expect(props(vertical, 'title').size).toBeCloseTo(0.1 * 0.5625, 5);
  });

  it('a custom size works the same way', () => {
    const wide = ok(reformat(landscape(), { size: { width: 960, height: 540 } }));
    expect([wide.width, wide.height]).toEqual([960, 540]);
    expect(props(wide, 'card')).toMatchObject({ x: 0.75, width: 0.25 });
    expect(props(wide, 'title').size).toBeCloseTo(0.1, 5);
  });

  it('scales auto layout spacing with the content', () => {
    const doc = landscape();
    const laidOut = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? { ...c, autoLayout: { ...DEFAULT_AUTO_LAYOUT, gap: 40, padding: { top: 20, right: 20, bottom: 20, left: 20 } } } : c)) })) };
    const layout = findClip(ok(reformat(laidOut, { format: MotionFormat.Vertical })), 'card')!.clip.autoLayout!;
    expect(layout.gap).toBeCloseTo(40 * 0.5625, 5);
    expect(layout.padding.left).toBeCloseTo(20 * 0.5625, 5);
  });
});
