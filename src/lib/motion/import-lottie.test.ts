import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { Matte } from '@feega/motion-core/motion/mask';
import { apply2d } from '@feega/motion-core/motion/affine';
import { Ease } from '@feega/motion-core/motion/design';
import { addClip, setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';
import { ItemKind, displayListAt, type DisplayList, type Item, type PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook } from './gpu-full/text/test-face';
import { lottieOf } from './export-lottie';
import { importLottie, lottieSource } from './import-lottie';

const still = (k: unknown) => ({ a: 0, k });
const move = (from: number[], to: number[], o = { x: [0.42], y: [0] }, i = { x: [0.58], y: [1] }) => ({ a: 1, k: [{ t: 0, s: from, o, i }, { t: 30, s: to }] });
const transform = (extra: Record<string, unknown> = {}) => ({ o: still(100), r: still(0), p: still([100, 100, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...extra });
const rect = (size = [40, 20]) => ({ ty: 'rc', p: still([0, 0]), s: still(size), r: still(0) });
const fill = (c = [1, 0, 0, 1]) => ({ ty: 'fl', c: still(c), o: still(100), r: 1 });
const neutral = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100) };
const group = (it: unknown[]) => ({ ty: 'gr', it: [...it, neutral] });
const shapeLayer = (extra: Record<string, unknown> = {}, shapes: unknown[] = [group([rect(), fill()])]) => ({ ddd: 0, ind: 1, ty: 4, nm: 'card', ks: transform(), ip: 0, op: 30, st: 0, shapes, ...extra });
const comp = (layers: unknown[], extra: Record<string, unknown> = {}) => ({ v: '5.7.0', fr: 30, ip: 0, op: 30, w: 200, h: 100, layers, assets: [], ...extra });

const imported = (json: unknown) => {
  let n = 0;
  const made = importLottie(json, () => `id${++n}`);
  if (typeof made === 'string') {
    throw new Error(made);
  }
  return made;
};
const clips = (doc: MotionDoc): MotionClip[] => doc.tracks.flatMap((t) => t.clips as MotionClip[]);
const byName = (doc: MotionDoc, name: string) => clips(doc).filter((c) => c.name === name);

describe('importLottie', () => {
  it('refuses what is not a Lottie', () => {
    expect(importLottie({ hello: 1 })).toMatch(/Lottie/);
    expect(importLottie('nope')).toMatch(/Lottie/);
  });

  it('sizes the frame as the animation and times it in frames', () => {
    const { doc } = imported(comp([shapeLayer()], { fr: 24, op: 48, w: 300, h: 150 }));

    expect(doc).toMatchObject({ width: 300, height: 150, fps: 24, durationInFrames: 48 });
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('draws a shape layer as a path clip with its fill', () => {
    const { doc, skipped } = imported(comp([shapeLayer()]));
    const [card] = byName(doc, 'card');

    expect(card).toMatchObject({ component: 'Shape', props: { shape: 'path', fill: '#ff0000' }, from: 0, durationInFrames: 30 });
    expect(skipped).toEqual([]);
  });

  it('keeps a move as keyframes with the bezier handles of Lottie', () => {
    const layer = shapeLayer({ ks: transform({ p: move([20, 50, 0], [180, 50, 0]) }) });
    const [card] = byName(imported(comp([layer])).doc, 'card');

    expect(card.keyframes.x).toEqual([expect.objectContaining({ frame: 0, ease: [0.42, 0, 0.58, 1] }), expect.objectContaining({ frame: 30 })]);
    expect(Number(card.keyframes.x[1].value) - Number(card.keyframes.x[0].value)).toBeCloseTo(160 / 200);
  });

  it('turns a hold keyframe into a hold', () => {
    const layer = shapeLayer({ ks: transform({ o: { a: 1, k: [{ t: 0, s: [0], h: 1 }, { t: 15, s: [100] }] } }) });
    const [card] = byName(imported(comp([layer])).doc, 'card');

    expect(card.keyframes.opacity[0]).toMatchObject({ out: 'hold', value: 0 });
  });

  it('maps rotation, scale and opacity', () => {
    const layer = shapeLayer({ ks: transform({ r: still(45), s: still([50, 200, 100]), o: still(50) }) });
    const [card] = byName(imported(comp([layer])).doc, 'card');

    expect(card.transform).toMatchObject({ rotateZ: 45, scaleX: 0.5, scaleY: 2, opacity: 0.5 });
  });

  it('draws every path of a group as its own clip with the same fill', () => {
    const layer = shapeLayer({}, [group([rect(), { ty: 'el', p: still([50, 0]), s: still([20, 20]) }, fill([0, 1, 0, 1])])]);
    const found = byName(imported(comp([layer])).doc, 'card');

    expect(found).toHaveLength(2);
    expect(found.every((c) => c.props.fill === '#00ff00')).toBe(true);
  });

  it('reads strokes and gradients', () => {
    const stroke = { ty: 'st', c: still([0, 0, 1, 1]), o: still(100), w: still(4), lc: 2, lj: 2 };
    const gradient = { ty: 'gf', t: 1, s: still([-20, 0]), e: still([20, 0]), g: { p: 2, k: still([0, 1, 0, 0, 1, 0, 0, 1]) }, o: still(100), r: 1 };
    const [stroked] = byName(imported(comp([shapeLayer({}, [group([rect(), stroke])])])).doc, 'card');
    const [shaded] = byName(imported(comp([shapeLayer({}, [group([rect(), gradient])])])).doc, 'card');

    expect(stroked.props).toMatchObject({ strokeKind: 'solid', stroke: '#0000ff', cap: 'round', join: 'round' });
    expect(stroked.props.strokeWidth).toBeCloseTo(4 / 100);
    expect(shaded.props.fills).toEqual([expect.objectContaining({ type: 'linear-gradient', stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }] })]);
  });

  it('keeps a still group transform in the geometry and an animated one in the keyframes', () => {
    const moved = { ty: 'gr', it: [rect(), fill(), { ...neutral, p: still([30, 0]) }] };
    const spinning = { ty: 'gr', it: [rect(), fill(), { ...neutral, r: { a: 1, k: [{ t: 0, s: [0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } }, { t: 30, s: [90] }] } }] };
    const [parked] = byName(imported(comp([shapeLayer({}, [moved])])).doc, 'card');
    const [spin] = byName(imported(comp([shapeLayer({}, [spinning])])).doc, 'card');

    expect(parked.keyframes).toEqual({});
    expect(spin.keyframes.rotateZ.at(-1)).toMatchObject({ value: 90 });
  });

  it('draws a solid layer', () => {
    const solid = { ddd: 0, ind: 1, ty: 1, nm: 'bg', sw: 200, sh: 100, sc: '#00ff00', ks: transform({ p: still([100, 50, 0]), a: still([100, 50, 0]) }), ip: 0, op: 30, st: 0 };
    const [bg] = byName(imported(comp([solid])).doc, 'bg');

    expect(bg).toMatchObject({ component: 'Shape', props: { fill: '#00ff00', width: 1, height: 1 } });
  });

  it('draws a text layer', () => {
    const text = { ddd: 0, ind: 1, ty: 5, nm: 'title', ks: transform(), ip: 0, op: 30, st: 0, t: { d: { k: [{ s: { s: 24, f: 'Arial', t: 'Hello', fc: [1, 1, 1], j: 0 }, t: 0 }] } } };
    const [title] = byName(imported(comp([text])).doc, 'title');

    expect(title).toMatchObject({ component: 'Text', props: { text: 'Hello', color: '#ffffff' } });
  });

  it('nests a precomp as a composition', () => {
    const inner = shapeLayer({ nm: 'inner' });
    const host = { ddd: 0, ind: 1, ty: 0, nm: 'host', refId: 'c1', w: 200, h: 100, ks: transform({ p: still([100, 50, 0]), a: still([100, 50, 0]) }), ip: 0, op: 30, st: 0 };
    const { doc } = imported(comp([host], { assets: [{ id: 'c1', layers: [inner] }] }));
    const [precomp] = byName(doc, 'host');
    const compId = precomp.props.comp as string;

    expect(precomp.component).toBe('Precomp');
    expect(doc.comps[compId].tracks.flatMap((t) => t.clips).map((c) => c.name)).toEqual(['inner']);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('follows a parent layer by baking the pose', () => {
    const linear = { x: [0], y: [0] };
    const parent = { ddd: 0, ind: 1, ty: 3, nm: 'null', ks: transform({ p: move([0, 0, 0], [100, 0, 0], linear, { x: [1], y: [1] }) }), ip: 0, op: 30, st: 0 };
    const child = shapeLayer({ ind: 2, parent: 1 });
    const [card] = byName(imported(comp([child, parent])).doc, 'card');

    expect(Number(card.keyframes.x.at(-1)!.value)).toBeCloseTo(100 / 200);
  });

  it('turns a path mask into a polygon mask', () => {
    const zero = [[0, 0], [0, 0], [0, 0], [0, 0]];
    const square = { i: zero, o: zero, v: [[-10, -10], [10, -10], [10, 10], [-10, 10]], c: true };
    const layer = shapeLayer({ hasMask: true, masksProperties: [{ mode: 'a', inv: false, pt: still(square), o: still(100), x: still(0) }] });
    const [card] = byName(imported(comp([layer])).doc, 'card');

    expect(card.mask).toMatchObject({ kind: 'polygon', mode: 'add', invert: false });
  });

  it('links a track matte to the layer above', () => {
    const source = shapeLayer({ nm: 'shape', ind: 1, td: 1 });
    const target = shapeLayer({ nm: 'photo', ind: 2, tt: 1 });
    const { doc } = imported(comp([source, target]));
    const [shape] = byName(doc, 'shape');
    const [photo] = byName(doc, 'photo');

    expect(photo).toMatchObject({ matte: Matte.Alpha, matteFrom: shape.id });
  });

  it('keeps a layer that sits beyond the frame', () => {
    const layer = shapeLayer({ ks: transform({ p: still([500, 50, 0]) }) });
    const { doc } = imported(comp([layer]));
    const [card] = byName(doc, 'card');

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(Number(card.props.x)).toBeLessThanOrEqual(1);
    expect(card.transform.x).toBeGreaterThan(0);
  });

  it('lists what it could not carry over and still draws the rest', () => {
    const trimmed = shapeLayer({ nm: 'trim' }, [group([rect(), fill(), { ty: 'tm', s: still(0), e: still(50), o: still(0) }])]);
    const picture = { ddd: 0, ind: 3, ty: 2, nm: 'photo', refId: 'img', ks: transform(), ip: 0, op: 30, st: 0 };
    const { doc, skipped } = imported(comp([trimmed, picture]));

    expect(byName(doc, 'trim')).toHaveLength(1);
    expect(skipped).toEqual(expect.arrayContaining([expect.stringContaining('trim path'), expect.stringContaining('image layer')]));
    expect(byName(doc, 'photo')).toHaveLength(1);
  });
});

describe('lottieSource', () => {
  const json = JSON.stringify(comp([shapeLayer()]));
  const bytes = (text: string) => new TextEncoder().encode(text);

  it('reads a json file', () => {
    expect(lottieSource(bytes(json))).toMatchObject({ w: 200 });
  });

  it('reads the first animation of a dotLottie file', () => {
    const packed = zipSync({ 'manifest.json': bytes('{}'), 'animations/a.json': bytes(json) });

    expect(lottieSource(packed)).toMatchObject({ w: 200 });
  });

  it('says why it cannot read', () => {
    expect(lottieSource(bytes('{'))).toMatch(/JSON/);
  });
});

describe('export then import', () => {
  const boxType = { fonts: boxBook(), smoothing: Smoothing.Plain };
  const must = (r: OpResult): MotionDoc => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };
  const card = { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' };
  const base = must(addClip({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 30 }, { component: 'Shape', from: 0, durationInFrames: 30, props: card }, 'card'));
  const authored = must(setKeyframes(base, 'card', 'x', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 29, value: 0.8, ease: Ease.Linear }]));
  const lists = (doc: MotionDoc) => Array.from({ length: doc.durationInFrames }, (_, f) => displayListAt(doc, f, FEEGA_TOKENS, boxType));
  const paths = (items: readonly Item[]): PathItem[] => items.flatMap((i) => (i.kind === ItemKind.Group ? paths(i.items) : [i as PathItem]));
  const centre = (list: DisplayList, doc: MotionDoc, clip: string) => {
    const item = paths(list.items).find((p) => p.clip === clip)!;
    const points = item.contours.flatMap((c) => Array.from({ length: c.length / 2 }, (_, k) => apply2d(item.matrix, [c[2 * k], c[2 * k + 1]])));
    return { x: points.reduce((s, p) => s + p[0], 0) / points.length / doc.width, y: points.reduce((s, p) => s + p[1], 0) / points.length / doc.height };
  };

  it('puts the card where it was, at the start, the middle and the end', () => {
    const { json } = lottieOf(lists(authored), { width: authored.width, height: authored.height, fps: authored.fps });
    const back = imported(json).doc;
    const before = lists(authored);
    const after = lists(back);

    const cardId = byName(back, 'card:0')[0].id;
    for (const f of [0, 15, 29]) {
      expect(centre(after[f], back, cardId).x).toBeCloseTo(centre(before[f], authored, 'card').x, 1);
      expect(centre(after[f], back, cardId).y).toBeCloseTo(centre(before[f], authored, 'card').y, 1);
    }
    expect(back.width).toBe(authored.width);
    expect(parseMotionDoc(back).ok).toBe(true);
  });
});
