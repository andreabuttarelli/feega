import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { MaskKind, MaskMode, Matte, maskSchema } from '../mask';
import { CoverKind, displayListAt, ItemKind, Unsupported, type PathItem } from './display-list';
import { apply2d } from '../affine';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fill: '#ff0000' };
const withCard = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: square }, 'card'));
const patch = (doc: MotionDoc, id: string, change: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...change } : c)) })) });
const card = (doc: MotionDoc, frame = 0) => displayListAt(doc, frame, FEEGA_TOKENS).items.find((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'card');
const mask = (input: Record<string, unknown>) => maskSchema.parse(input);

type CoverOf = NonNullable<PathItem['masks']>[number]['cover'];

describe('keyframed masks', () => {
  it('draws a mask whose box is keyframed, sampled at the frame', () => {
    const masked = patch(withCard, 'card', { mask: mask({ kind: MaskKind.Rect, x: 0.5, y: 0.5, width: 1, height: 1 }), keyframes: { maskWidth: [{ frame: 0, value: 0, ease: 'linear' }, { frame: 10, value: 1, ease: 'linear' }] } });
    const drawn = displayListAt(masked, 5, FEEGA_TOKENS);
    const cover = card(masked, 5)?.masks?.[0].cover as Extract<CoverOf, { kind: CoverKind.Path }>;

    expect(drawn.unsupported).toEqual([]);
    expect(cover.matrix[0]).toBeCloseTo(960);
  });
});

describe('own masks', () => {
  it('places a rectangle mask in frame space with its feather and mode', () => {
    const masked = patch(withCard, 'card', { mask: mask({ kind: MaskKind.Rect, x: 0.25, y: 0.5, width: 0.5, height: 1, feather: 12 }) });
    const [layer] = card(masked)?.masks ?? [];
    const cover = layer.cover as Extract<typeof layer.cover, { kind: CoverKind.Path }>;
    const xs = cover.contours.flatMap((c) => c.filter((_, i) => i % 2 === 0).map((x, i) => apply2d(cover.matrix, [x, c[i * 2 + 1]])[0]));

    expect(layer).toMatchObject({ mode: MaskMode.Add, invert: false, level: 1, feather: 12 });
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 960]);
  });

  it('stacks the extra masks after the primary one', () => {
    const masked = patch(withCard, 'card', { mask: mask({ kind: MaskKind.Ellipse }), maskStack: [mask({ kind: MaskKind.Linear, mode: MaskMode.Subtract, invert: true })] });

    expect(card(masked)?.masks?.map((m) => [m.cover.kind, m.mode, m.invert])).toEqual([
      [CoverKind.Path, MaskMode.Add, false],
      [CoverKind.Ramp, MaskMode.Subtract, true]
    ]);
  });

  it('names a text mask, which needs the text engine', () => {
    const masked = patch(withCard, 'card', { mask: mask({ kind: MaskKind.Text }) });

    expect(displayListAt(masked, 0, FEEGA_TOKENS).unsupported).toContainEqual({ clip: 'card', component: 'Shape', reason: Unsupported.Mask });
  });
});

describe('track mattes', () => {
  it('hides the source above and hands its items to the target as a matte', () => {
    const base = withCard.tracks[0].clips[0];
    const hole = { ...base, id: 'hole', props: { ...base.props, shape: 'ellipse' } };
    const stacked = { ...withCard, tracks: [{ ...withCard.tracks[0], id: 'top', clips: [hole] }, ...withCard.tracks] };
    const doc = patch(stacked, 'card', { matte: Matte.LumaInverted });
    const drawn = displayListAt(doc, 0, FEEGA_TOKENS);

    expect(drawn.items.map((i) => i.clip)).not.toContain('hole');
    expect(card(doc)?.matte).toMatchObject({ luma: true, invert: true });
    expect(card(doc)?.matte?.items.map((i) => i.clip)).toEqual(['hole']);
  });
});
