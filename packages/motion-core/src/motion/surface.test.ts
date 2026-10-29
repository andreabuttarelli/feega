import { describe, expect, it } from 'vitest';
import { Background, MotionFormat, newMotionDoc, parseMotionDoc } from './doc';
import { FEEGA_TOKENS } from './brand';
import { displayListAt } from './gpu-full/display-list';
import { setProps } from './timeline';
import { exportCode } from './codegen/index';
import { addClip } from './timeline';
import { composeHtml } from './hyperframes/compose';
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

function roundedWithCard(clipContent?: boolean) {
  const card = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.05, y: 0.05, width: 0.3, height: 0.3 } }, 'card');
  if (!card.ok) {
    throw new Error(card.error);
  }
  const surfaced = withSurface(card.doc, SURFACE);
  const rounded = setProps(surfaced, SURFACE, { roundness: 0.1 });
  if (!rounded.ok) {
    throw new Error(rounded.error);
  }
  const doc = rounded.doc;
  return clipContent === undefined ? doc : { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === SURFACE ? { ...c, clipContent } : c)) })) };
}

const itemsOf = (doc: ReturnType<typeof roundedWithCard>, clip: string) => displayListAt(doc, 0, FEEGA_TOKENS).items.filter((i) => i.clip === clip);

describe('clip content on the frame surface', () => {
  it('is on by default: layers are cut to the rounded corners in the GPU renderer', () => {
    const doc = roundedWithCard();

    expect(itemsOf(doc, 'card').every((i) => i.masks?.some((m) => m.cover.kind === 'path'))).toBe(true);
    expect(itemsOf(doc, SURFACE).some((i) => i.masks?.length)).toBe(false);
  });

  it('off leaves the layers uncut', () => {
    expect(itemsOf(roundedWithCard(false), 'card').some((i) => i.masks?.length)).toBe(false);
  });

  it('rounds the HTML root only while it clips', () => {
    const html = (doc: ReturnType<typeof roundedWithCard>) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://feega.app' });

    expect(html(roundedWithCard())).toMatch(/#root\{border-radius:108px 108px 108px 108px\}/);
    expect(html(roundedWithCard(false))).not.toMatch(/#root\{border-radius/);
  });

  it('a code export hides overflow on the page only while it clips', () => {
    const main = (doc: ReturnType<typeof roundedWithCard>) => exportCode(doc).files.map((f) => f.content).join('\n').match(/<main className="([^"]*)"/)?.[1] ?? '';

    expect(main(roundedWithCard())).toContain('overflow-hidden');
    expect(main(roundedWithCard(false))).not.toContain('overflow-hidden');
  });
});
