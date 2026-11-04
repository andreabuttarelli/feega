import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip } from './doc';
import { composeHtml } from './hyperframes/compose';
import { FEEGA_TOKENS } from './brand';
import { WATERMARK_CLIP_ID, WATERMARK_TEXT, withWatermark } from './watermark';

const markOf = (doc: ReturnType<typeof newMotionDoc>) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.id === WATERMARK_CLIP_ID);

describe('withWatermark', () => {
  it('adds one text clip over the whole duration, on the top track', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);

    const marked = withWatermark(doc);

    const [mark] = markOf(marked);
    expect(markOf(marked)).toHaveLength(1);
    expect(marked.tracks[0].clips).toContain(mark);
    expect(mark.component).toBe('Text');
    expect(mark.props.text).toBe(WATERMARK_TEXT);
    expect(mark.from).toBe(0);
    expect(mark.durationInFrames).toBe(doc.durationInFrames);
  });

  it('sits in the bottom right corner, inside the frame, semi-transparent', () => {
    for (const format of [MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square]) {
      const [mark] = markOf(withWatermark(newMotionDoc(format)));
      const { x, y, width, height, opacity } = mark.props as Record<string, number>;

      expect(x + width / 2).toBeLessThanOrEqual(1);
      expect(y + height / 2).toBeLessThanOrEqual(1);
      expect(x).toBeGreaterThan(0.5);
      expect(y).toBeGreaterThan(0.85);
      expect(opacity).toBeLessThan(1);
      expect(opacity).toBeGreaterThan(0);
    }
  });

  it('scales with the short side of the frame', () => {
    const small = { ...newMotionDoc(MotionFormat.Landscape), width: 640, height: 360 };
    const large = { ...newMotionDoc(MotionFormat.Landscape), width: 3840, height: 2160 };

    const pixels = (doc: typeof small) => (markOf(withWatermark(doc))[0].props.size as number) * Math.min(doc.width, doc.height);

    expect(pixels(large) / pixels(small)).toBeCloseTo(6, 5);
  });

  it('leaves the given doc untouched and marks a marked doc once', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);

    const marked = withWatermark(doc);

    expect(markOf(doc)).toHaveLength(0);
    expect(withWatermark(marked)).toBe(marked);
  });

  it('is drawn by the compositor', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);

    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} })).not.toContain(WATERMARK_TEXT);
    expect(composeHtml({ doc: withWatermark(doc), tokens: FEEGA_TOKENS, assets: {} })).toContain(WATERMARK_TEXT);
  });
});
