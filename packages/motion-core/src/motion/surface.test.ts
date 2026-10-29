import { describe, expect, it } from 'vitest';
import { Background, MotionFormat, newMotionDoc, parseMotionDoc } from './doc';
import { FEEGA_TOKENS } from './brand';
import { displayListAt } from './gpu-full/display-list';
import { setProps } from './timeline';
import { exportCode } from './codegen/index';
import { dropSurface, frameSurface, withSurface } from './surface';

const SURFACE = 'surface';

describe('the frame surface', () => {
  it('a new frame has none', () => {
    expect(frameSurface(newMotionDoc(MotionFormat.Landscape))).toBeNull();
  });

  it('is a locked full-frame rectangle under every layer, painted in the brand background', () => {
    const doc = withSurface(newMotionDoc(MotionFormat.Landscape), SURFACE);
    const clip = frameSurface(doc)!;

    expect(clip.id).toBe(SURFACE);
    expect(clip.locked).toBe(true);
    expect(clip.props).toMatchObject({ shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: 'brand.background' }] });
    expect(clip.durationInFrames).toBe(doc.durationInFrames);
    expect(doc.background).toBe(Background.Transparent);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('is added once and keeps spanning the frame when it grows longer', () => {
    const doc = withSurface(newMotionDoc(MotionFormat.Landscape), SURFACE);
    const longer = withSurface({ ...doc, durationInFrames: doc.durationInFrames * 2 }, 'other');

    expect(longer.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Shape')).toHaveLength(1);
    expect(frameSurface(longer)!.durationInFrames).toBe(longer.durationInFrames);
  });

  it('the GPU renderer draws it', () => {
    const doc = withSurface(newMotionDoc(MotionFormat.Landscape), SURFACE);

    expect(displayListAt(doc, 0, FEEGA_TOKENS).items.length).toBeGreaterThan(0);
  });

  it('dropping it brings back the brand background', () => {
    const doc = dropSurface(withSurface(newMotionDoc(MotionFormat.Landscape), SURFACE));

    expect(frameSurface(doc)).toBeNull();
    expect(doc.background).toBe(Background.Brand);
    expect(doc.tracks.some((t) => t.clips.length === 0 && t.id === SURFACE)).toBe(false);
  });
});

describe('the frame surface in a code export', () => {
  it('paints the page with its fill, stroke and corners', () => {
    const doc = withSurface(newMotionDoc(MotionFormat.Landscape), SURFACE);
    const solid = (color: string) => ({ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' });
    const styled = setProps(doc, SURFACE, { fills: [solid('#123456')], strokes: [{ paint: solid('#abcdef'), width: 0.01, align: 'inside' }], roundness: 0.05 });
    if (!styled.ok) {
      throw new Error(styled.error);
    }

    const code = exportCode(styled.doc).files.map((f) => f.content).join('\n');

    expect(code).toContain('#123456');
    expect(code).toContain('#abcdef');
    expect(code).toMatch(/<main className="[^"]*bg-[^"]*border-[^"]*rounded-/);
  });
});
