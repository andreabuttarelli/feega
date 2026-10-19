import { describe, expect, it } from 'vitest';
import { ScaleMode, bakeScale, flipScale, scaleClips } from './scale-tool';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setTransform, type OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const stroked = { component: 'Shape' as const, from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, strokes: [{ paint: { type: 'solid', color: '#000000' }, width: 0.01 }] } };
const words = { component: 'Text' as const, from: 0, durationInFrames: 30, props: { text: 'hi', x: 0.25, y: 0.25, width: 0.2, height: 0.1, size: 0.05 } };

const props = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip.props as Record<string, unknown>;

describe('the scale tool', () => {
  it('scales the box, the text size and the stroke weight together', () => {
    const doc = ok(scaleClips(ok(addClip(ok(addClip(newMotionDoc(MotionFormat.Landscape), stroked, 'box')), words, 'words')), ['box', 'words'], 2, [960, 540]));

    expect(props(doc, 'box')).toMatchObject({ width: 0.4, height: 0.4, x: 0.5, y: 0.5 });
    expect((props(doc, 'box').strokes as { width: number }[])[0].width).toBeCloseTo(0.02);
    expect(props(doc, 'words')).toMatchObject({ size: 0.1, width: 0.4 });
  });

  it('moves each layer away from the origin by the same factor', () => {
    const doc = ok(scaleClips(ok(addClip(newMotionDoc(MotionFormat.Landscape), words, 'words')), ['words'], 2, [0, 0]));

    expect(props(doc, 'words')).toMatchObject({ x: 0.5, y: 0.5 });
  });

  it('refuses a factor that is not positive', () => {
    expect(scaleClips(ok(addClip(newMotionDoc(MotionFormat.Landscape), words, 'words')), ['words'], 0, [0, 0]).ok).toBe(false);
  });

  it('a handle drag in scale mode bakes into the properties and leaves the transform scale alone', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), words, 'words'));

    const baked = ok(bakeScale(doc, 'words', 0, { scaleX: 1.5, scaleY: 1.5 }));

    expect(props(baked, 'words').size).toBeCloseTo(0.075);
    expect(findClip(baked, 'words')!.clip.transform.scaleX).toBeUndefined();
  });

  it('a clip already scaled by its transform bakes only the change', () => {
    const doc = ok(setTransform(ok(addClip(newMotionDoc(MotionFormat.Landscape), words, 'words')), 'words', { scaleX: 2, scaleY: 2 }));

    expect(props(ok(bakeScale(doc, 'words', 0, { scaleX: 3, scaleY: 3 })), 'words').size).toBeCloseTo(0.075);
  });

  it('K turns the scale tool on and off', () => {
    expect(flipScale(ScaleMode.Resize)).toBe(ScaleMode.Scale);
    expect(flipScale(ScaleMode.Scale)).toBe(ScaleMode.Resize);
  });
});
