import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { composeHtml } from './hyperframes/compose';
import { addClip, type OpResult } from './timeline';
import { setClipFlags } from './organize';
import { pathData, rectOutline } from './shape/geometry';
import { COMPONENTS } from './components';
import { shapeMarkup, type ShapeLook } from './shape/render';
import { Flip, flipClips, flipPatch } from './layer-props';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SIZE = { w: 100, h: 100 };
const look = (patch: Record<string, unknown>) => COMPONENTS.Shape.schema.parse({ shape: 'rect', ...patch }) as unknown as ShapeLook;
const paint = { id: 'a', size: { w: 200, h: 100 }, unit: 1000, time: 0, color: (v: string) => v };

describe('corner smoothing', () => {
  it('no smoothing draws the same circular corners as before', () => {
    expect(pathData(rectOutline(0.2, SIZE, 0))).toBe(pathData(rectOutline(0.2, SIZE)));
    expect(shapeMarkup(look({ roundness: 0.2 }), paint)).toBe(shapeMarkup(look({ roundness: 0.2, smoothing: 0 }), paint));
  });

  it('smoothing starts the curve further along each edge, like a squircle', () => {
    const [contour] = rectOutline(0.2, SIZE, 0.5);
    expect(contour.vertices[0].p).toEqual([70, 0]);
    expect(contour.vertices[1].p).toEqual([100, 30]);
  });

  it('a shape stores smoothing 0..1, default 0', () => {
    expect(look({}).smoothing).toBe(0);
    expect(COMPONENTS.Shape.schema.safeParse({ shape: 'rect', smoothing: 2 }).success).toBe(false);
  });
});

describe('flip', () => {
  it('flips a layer by turning its scale on that axis negative, and back', () => {
    expect(flipPatch({ scaleX: 1, scaleY: 1 }, Flip.Horizontal)).toEqual({ scaleX: -1 });
    expect(flipPatch({ scaleX: -1.5, scaleY: 1 }, Flip.Horizontal)).toEqual({ scaleX: 1.5 });
    expect(flipPatch({ scaleY: 2 }, Flip.Vertical)).toEqual({ scaleY: -2 });
    expect(flipPatch({}, Flip.Vertical)).toEqual({ scaleY: -1 });
  });
});

describe('clip content', () => {
  const base = () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5 } }, 'box'));
    doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.9, y: 0.5, width: 0.4, height: 0.2 } }, 'kid'));
    return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'kid' ? { ...c, parent: 'box' } : c)) })) };
  };
  const html = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

  it('is stored on the clip and survives a round trip', () => {
    const doc = must(setClipFlags(base(), 'box', { clipContent: true }));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));
    expect(parsed.ok && findClip(parsed.doc, 'box')!.clip.clipContent).toBe(true);
  });

  it('crops a child to its parent box; without it the child spills over as before', () => {
    const clipped = html(must(setClipFlags(base(), 'box', { clipContent: true })));
    expect(clipped).toMatch(/data-clip="kid"[^>]*style="[^"]*clip-path:inset\(270px 270px 270px 270px\)/);
    expect(html(base())).not.toContain('clip-path:inset(');
  });
});

describe('⇧H / ⇧V flip every selected layer', () => {
  const doc = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect' } }, 'a')), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 'b'));

  it('negates the scale on the flipped axis of each layer', () => {
    const flipped = must(flipClips(doc, ['a', 'b'], Flip.Horizontal));
    expect(findClip(flipped, 'a')!.clip.transform.scaleX).toBe(-1);
    expect(findClip(flipped, 'b')!.clip.transform.scaleX).toBe(-1);
    expect(findClip(flipped, 'a')!.clip.transform.scaleY).toBeUndefined();
  });

  it('flips an animated scale on every keyframe, so the animation stays mirrored', () => {
    const keyed = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'a' ? { ...c, keyframes: { scaleY: [{ frame: 0, value: 1 }, { frame: 30, value: 2 }] } } : c)) })) } as MotionDoc;
    const flipped = must(flipClips(keyed, ['a'], Flip.Vertical));
    expect(findClip(flipped, 'a')!.clip.keyframes.scaleY!.map((k) => k.value)).toEqual([-1, -2]);
  });

  it('flipping twice is the original', () => {
    const twice = must(flipClips(must(flipClips(doc, ['a'], Flip.Horizontal)), ['a'], Flip.Horizontal));
    expect(findClip(twice, 'a')!.clip.transform.scaleX).toBe(1);
  });
});
