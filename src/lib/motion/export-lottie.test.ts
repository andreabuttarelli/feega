import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { FEEGA_TOKENS } from './brand';
import { Background, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { Ease } from './design';
import { addClip, setKeyframes, type OpResult } from './timeline';
import { FillType } from './fill/model';
import { BlendMode } from './blend';
import { IDENTITY } from './affine';
import { ItemKind, PaintKind, displayListAt, type DisplayList, type PathItem } from './gpu-full/display-list';
import { FillRule } from './gpu-full/paint';
import { Smoothing } from './gpu-full/text/painter';
import { boxBook } from './gpu-full/text/test-face';
import { dotLottieOf, lottieOf } from './export-lottie';

const boxType = { fonts: boxBook(), smoothing: Smoothing.Plain };

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const patch = (doc: MotionDoc, id: string, change: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...change } : c)) })) });

const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' };
const base = newMotionDoc(MotionFormat.Landscape);
const withCard = must(addClip({ ...base, durationInFrames: 60 }, { component: 'Shape', from: 0, durationInFrames: 60, props: square }, 'card'));
const cardProps = withCard.tracks.flatMap((t) => t.clips).find((c) => c.id === 'card')!.props;

const lists = (doc: MotionDoc, frames = doc.durationInFrames) => Array.from({ length: frames }, (_, f) => displayListAt(doc, f, FEEGA_TOKENS, boxType));
const lottie = (doc: MotionDoc, frames?: number) => lottieOf(lists(doc, frames), { width: doc.width, height: doc.height, fps: doc.fps });

type Layer = { nm: string; ip: number; op: number; ks: Record<string, { a: number; k: unknown }>; shapes: { it: { ty: string; [key: string]: unknown }[] }[]; masksProperties?: unknown[] };
const layersOf = (json: unknown) => (json as { layers: Layer[] }).layers;
const layerOf = (json: unknown, clip: string) => layersOf(json).find((l) => l.nm.startsWith(`${clip}:`))!;
const itemOf = (layer: Layer, ty: string) => layer.shapes[0].it.find((i) => i.ty === ty)!;

describe('lottieOf', () => {
  it('describes the comp: size, rate and length', () => {
    const { json } = lottie(withCard);

    expect(json).toMatchObject({ w: 1920, h: 1080, fr: 30, ip: 0, op: 60, layers: expect.any(Array) });
  });

  it('draws a still shape as one layer with a path, a fill and a rest pose', () => {
    const layer = layerOf(lottie(withCard).json, 'card');
    const fill = itemOf(layer, 'fl') as { c: { k: number[] }; r: number };

    expect(layer.shapes[0].it.some((i) => i.ty === 'sh')).toBe(true);
    expect(fill.c.k.slice(0, 3)).toEqual([1, 0, 0]);
    expect(fill.r).toBe(1);
    expect(layer.ks.p).toEqual({ a: 0, k: [expect.any(Number), expect.any(Number), 0] });
    expect(layer.ks.s.a).toBe(0);
  });

  it('keeps a move as two position keyframes, not one per frame', () => {
    const moving = must(setKeyframes(withCard, 'card', 'x', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 59, value: 0.8, ease: Ease.Linear }]));
    const position = layerOf(lottie(moving).json, 'card').ks.p;
    const keys = position.k as { t: number; s: number[] }[];

    expect(position.a).toBe(1);
    expect(keys.map((k) => k.t)).toEqual([0, 59]);
    expect(keys[1].s[0] - keys[0].s[0]).toBeCloseTo(0.6 * 1920, 0);
  });

  it('keeps an opacity fade as keyframes from 100 to 0', () => {
    const fading = must(setKeyframes(withCard, 'card', 'opacity', [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 59, value: 0, ease: Ease.Linear }]));
    const opacity = layerOf(lottie(fading).json, 'card').ks.o;
    const keys = opacity.k as { t: number; s: number[] }[];

    expect(opacity.a).toBe(1);
    expect([keys[0].s[0], keys.at(-1)!.s[0]]).toEqual([100, 0]);
  });

  it('turns a scale and a rotation into the layer transform', () => {
    const turned = patch(withCard, 'card', { props: { ...cardProps, rotation: 90 } });
    const layer = layerOf(lottie(turned).json, 'card');

    expect(layer.ks.r.k).toBeCloseTo(90, 3);
  });

  it('keeps a gradient fill as a gradient with its colour stops', () => {
    const fills = [{ type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }];
    const layer = layerOf(lottie(patch(withCard, 'card', { props: { ...cardProps, fills } })).json, 'card');
    const gradient = itemOf(layer, 'gf') as { t: number; g: { p: number; k: { k: number[] } } };

    expect(gradient.t).toBe(1);
    expect(gradient.g.p).toBe(2);
    expect(gradient.g.k.k).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('writes text as shapes, so no font is needed to play it', () => {
    const titled = must(addClip(withCard, { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'ab' } }, 'title'));
    const settled = [displayListAt(titled, 40, FEEGA_TOKENS, boxType)];
    const { json, report } = lottieOf(settled, { width: titled.width, height: titled.height, fps: titled.fps });

    expect(layerOf(json, 'title').shapes[0].it.some((i) => i.ty === 'sh')).toBe(true);
    expect(JSON.stringify(json)).not.toContain('"ty":5');
    expect(report).toEqual([]);
  });

  it('keeps a rectangle mask as a layer mask', () => {
    const mask = { kind: 'rect', x: 0.5, y: 0.5, width: 0.05, height: 0.05, rotation: 0, expansion: 0, feather: 0, opacity: 1, invert: false, mode: 'add', assetId: null, points: [], text: '' };
    const layer = layerOf(lottie(patch(withCard, 'card', { mask } as never), 1).json, 'card');

    expect(layer.masksProperties).toEqual([expect.objectContaining({ mode: 'a', inv: false })]);
  });

  it('puts a background layer at the bottom, none when transparent', () => {
    const solid = layersOf(lottie(withCard, 1).json);
    const clear = layersOf(lottie({ ...withCard, background: Background.Transparent }, 1).json);

    expect(solid.at(-1)!.nm).toBe('background');
    expect(clear.some((l) => l.nm === 'background')).toBe(false);
  });

  it('lists what it could not write, once, naming the element and why', () => {
    const blended = patch(withCard, 'card', { blend: BlendMode.Multiply });
    const { report } = lottie(blended, 3);

    expect(report).toEqual(['card: blend mode multiply']);
    expect(layersOf(lottie(blended, 3).json).some((l) => l.nm.startsWith('card:'))).toBe(false);
  });

  it('bakes a skewed pose into the path, since a layer transform cannot hold it', () => {
    const skewed: PathItem = { kind: ItemKind.Path, clip: 's', contours: [[0, 0, 10, 0, 10, 10, 0, 10]], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [0, 1, 0, 1] }, opacity: 1, matrix: [1, 0, 1, 1, 5, 5], blur: 0, blend: BlendMode.Normal };
    const list: DisplayList = { width: 100, height: 100, background: null, items: [skewed], unsupported: [] };
    const layer = layerOf(lottieOf([list], { width: 100, height: 100, fps: 30 }).json, 's');
    const path = (itemOf(layer, 'sh') as { ks: { k: { v: number[][] } } }).ks.k.v;

    expect(layer.ks.s.k).toEqual([100, 100, 100]);
    expect(path[2]).toEqual([25, 15]);
  });

  it('gives every keyframe of a changing shape the same number of vertices, which players need', () => {
    const grow = (n: number): PathItem => ({ kind: ItemKind.Path, clip: 'm', contours: [Array.from({ length: n * 2 }, (_, i) => i)], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [1, 1, 1, 1] }, opacity: 1, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal });
    const frames = [3, 5, 4].map((n): DisplayList => ({ width: 10, height: 10, background: null, items: [grow(n)], unsupported: [] }));
    const path = itemOf(layerOf(lottieOf(frames, { width: 10, height: 10, fps: 30 }).json, 'm'), 'sh') as { ks: { k: { s: { v: number[][]; i: number[][]; o: number[][] }[] }[] } };

    expect(path.ks.k.map((k) => k.s[0].v.length)).toEqual([5, 5, 5]);
    expect(path.ks.k.map((k) => k.s[0].i.length)).toEqual([5, 5, 5]);
  });

  it('nests a group so its opacity multiplies into its children', () => {
    const child: PathItem = { kind: ItemKind.Path, clip: 'g', contours: [[0, 0, 10, 0, 10, 10]], rule: FillRule.EvenOdd, paint: { kind: PaintKind.Solid, color: [1, 1, 1, 1] }, opacity: 0.5, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal };
    const group = { kind: ItemKind.Group, clip: 'g', items: [child], opacity: 0.5, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal } as const;
    const list: DisplayList = { width: 100, height: 100, background: null, items: [group], unsupported: [] };
    const layer = layerOf(lottieOf([list], { width: 100, height: 100, fps: 30 }).json, 'g');

    expect(layer.ks.o.k).toBe(25);
    expect((itemOf(layer, 'fl') as { r: number }).r).toBe(2);
  });
});

describe('dotLottieOf', () => {
  it('packs the animation and a manifest naming it', () => {
    const { json } = lottie(withCard, 1);
    const files = unzipSync(dotLottieOf(json));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));

    expect(Object.keys(files).sort()).toEqual(['animations/animation.json', 'manifest.json']);
    expect(manifest.animations).toEqual([{ id: 'animation' }]);
    expect(JSON.parse(new TextDecoder().decode(files['animations/animation.json'])).w).toBe(1920);
  });
});
