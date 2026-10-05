import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, setProps, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from '../hyperframes/compose';
import { setExpression } from '../expression/ops';
import { AnimatorUnit } from '../text-animators/model';
import { addAnimator } from '../text-animators/ops';
import { editAt } from '../inspector';
import { placeGlyphs, type Curve, type Placement } from './layout';
import { presetCurve } from './curves';
import { PathAlign, PathPreset, PathSourceKind, TEXT_PATH, TEXT_PATH_KEYS, textPathKey } from './model';
import { removeTextPath, setTextPath } from './ops';
import { textPathBake, textPathOutline } from '../hyperframes/text-path';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const line: Curve = { points: [[0, 0], [100, 0]], closed: false };
const square: Curve = { points: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true };
const plain: Placement = { first: 0, last: 0, align: 0, reverse: false, perpendicular: true, force: false };
const xs = (placed: number[][]) => placed.map((p) => p[0]);

describe('placing glyphs on a curve', () => {
  it('start, center and end alignment put the run at the first margin, the middle, or the last margin', () => {
    expect(xs(placeGlyphs(line, [10, 10], plain))).toEqual([5, 15]);
    expect(xs(placeGlyphs(line, [10, 10], { ...plain, align: 0.5 }))).toEqual([45, 55]);
    expect(xs(placeGlyphs(line, [10, 10], { ...plain, align: 1 }))).toEqual([85, 95]);
  });

  it('margins are percent of the path length and slide the text along it', () => {
    expect(xs(placeGlyphs(line, [10, 10], { ...plain, first: 10 }))).toEqual([15, 25]);
    expect(xs(placeGlyphs(line, [10, 10], { ...plain, align: 1, last: 20 }))).toEqual([65, 75]);
  });

  it('force alignment spreads the glyphs from the first margin to the last', () => {
    expect(xs(placeGlyphs(line, [10, 10, 10], { ...plain, force: true }))).toEqual([5, 50, 95]);
  });

  it('a closed path wraps around, so a full turn of margin lands where it started', () => {
    expect(placeGlyphs(square, [10], { ...plain, first: 100 })).toEqual(placeGlyphs(square, [10], plain));
    expect(placeGlyphs(square, [10], { ...plain, first: 25 })[0]).toEqual([100, 5, 90]);
  });

  it('an open path continues straight past its ends', () => {
    expect(placeGlyphs(line, [10], { ...plain, first: 110 })[0]).toEqual([115, 0, 0]);
  });

  it('reverse runs the other way; perpendicular off keeps glyphs upright', () => {
    expect(placeGlyphs(line, [10], { ...plain, reverse: true })[0]).toEqual([95, 0, 180]);
    const down: Curve = { points: [[0, 0], [0, 100]], closed: false };
    expect(placeGlyphs(down, [10], plain)[0][2]).toBe(90);
    expect(placeGlyphs(down, [10], { ...plain, perpendicular: false })[0][2]).toBe(0);
  });

  it('repeated points do not turn a glyph', () => {
    const stutter: Curve = { points: [[0, 0], [50, 0], [50, 0], [100, 0]], closed: false };
    expect(placeGlyphs(stutter, [10, 10], { ...plain, first: 45 }).map((p) => p[2])).toEqual([0, 0]);
  });
});

describe('preset curves', () => {
  const box = { w: 400, h: 400 };
  const at = (c: Curve, i: number) => c.points[i].map((n) => Math.round(n));

  it('a circle starts at the bottom and runs clockwise through the top, so centred text sits on top', () => {
    const c = presetCurve(PathPreset.Circle, { radius: 100, arc: 180 }, box);
    expect(c.closed).toBe(true);
    expect(at(c, 0)).toEqual([200, 300]);
    expect(at(c, c.points.length / 2)).toEqual([200, 100]);
  });

  it('an arc spans its degrees around the top; a line and a wave cross the box', () => {
    const arc = presetCurve(PathPreset.Arc, { radius: 100, arc: 180 }, box);
    expect(arc.closed).toBe(false);
    expect(at(arc, 0)).toEqual([100, 200]);
    expect(at(arc, arc.points.length - 1)).toEqual([300, 200]);

    expect(presetCurve(PathPreset.Line, { radius: 100, arc: 180 }, box).points).toEqual([[0, 200], [400, 200]]);
    const wave = presetCurve(PathPreset.Wave, { radius: 50, arc: 360 }, box);
    expect(at(wave, 0)).toEqual([0, 200]);
    expect(Math.min(...wave.points.map((p) => p[1]))).toBeCloseTo(150);
  });

  it('an ellipse is flatter than its circle', () => {
    const e = presetCurve(PathPreset.Ellipse, { radius: 100, arc: 180 }, box);
    expect(Math.min(...e.points.map((p) => p[1]))).toBeGreaterThan(100);
  });
});

const titled = () => ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Round we go' } }, 'title'));
const withShape = (doc: MotionDoc) => ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'circle', width: 0.4, height: 0.4 } }, 'ring'));
const pathOf = (doc: MotionDoc) => findClip(doc, 'title')!.clip.textPath;
const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('text path ops', () => {
  it('sets a preset path with defaults, merges patches, survives a parse round trip, and removes with its keyframes', () => {
    let doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Circle } }));
    expect(pathOf(doc)).toMatchObject({ source: { kind: 'preset', preset: 'circle' }, align: 'start', reverse: false, perpendicular: true, forceAlign: false, firstMargin: 0 });

    doc = ok(setTextPath(doc, 'title', { align: PathAlign.Center, radius: 250 }));
    expect(pathOf(doc)).toMatchObject({ source: { preset: 'circle' }, align: 'center', radius: 250 });
    expect(parseMotionDoc(JSON.parse(JSON.stringify(doc))).ok).toBe(true);

    doc = ok(setKeyframes(doc, 'title', textPathKey('firstMargin'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 29, value: 100, ease: Ease.Linear }]));
    doc = ok(setExpression(doc, 'title', textPathKey('radius'), '200 + time * 10'));
    doc = ok(removeTextPath(doc, 'title'));
    expect(findClip(doc, 'title')!.clip).toMatchObject({ textPath: null, keyframes: {}, expressions: {} });
  });

  it('refuses a path on clips without text, a source that is not a shape, and animators split by word', () => {
    const shaped = withShape(titled());
    expect(setTextPath(shaped, 'ring', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Line } })).toMatchObject({ ok: false });
    expect(setTextPath(shaped, 'title', { source: { kind: PathSourceKind.Clip, clip: 'nope' } })).toMatchObject({ ok: false });
    expect(setTextPath(shaped, 'title', { source: { kind: PathSourceKind.Clip, clip: 'ring' } })).toMatchObject({ ok: true });

    const words = ok(addAnimator(titled(), 'title', 'a', { unit: AnimatorUnit.Word }));
    expect(setTextPath(words, 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Line } })).toMatchObject({ ok: false });
    const onPath = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Line } }));
    expect(addAnimator(onPath, 'title', 'a', { unit: AnimatorUnit.Word })).toMatchObject({ ok: false });
    expect(addAnimator(onPath, 'title', 'a', { unit: AnimatorUnit.Char })).toMatchObject({ ok: true });
  });

  it('every property is keyframable, and the inspector edits the base when nothing is keyed', () => {
    const doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Arc } }));
    for (const key of TEXT_PATH_KEYS) {
      const { min, max } = TEXT_PATH[key];
      expect(setKeyframes(doc, 'title', textPathKey(key), [{ frame: 0, value: min, ease: Ease.Linear }, { frame: 10, value: max, ease: Ease.Linear }])).toMatchObject({ ok: true });
    }
    expect(TEXT_PATH_KEYS).toHaveLength(8);
    expect(pathOf(ok(editAt(doc, findClip(doc, 'title')!.clip, textPathKey('arc'), 270, 0)))).toMatchObject({ arc: 270 });
    expect(pathOf(ok(editAt(doc, findClip(doc, 'title')!.clip, textPathKey('reverse'), 1, 0)))).toMatchObject({ reverse: true });
    expect(setKeyframes(titled(), 'title', textPathKey('radius'), [{ frame: 0, value: 1, ease: Ease.Linear }])).toMatchObject({ ok: false });
  });
});

const env = { width: 1080, height: 1080 };

describe('text path bake', () => {
  it('a keyed margin changes the placement per frame while the curve is shared', () => {
    let doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Circle } }));
    doc = ok(setKeyframes(doc, 'title', textPathKey('firstMargin'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 29, value: 100, ease: Ease.Linear }]));
    const bake = textPathBake(findClip(doc, 'title')!.clip, doc, env);

    expect(bake.curves).toHaveLength(1);
    expect(bake.index).toHaveLength(30);
    expect(bake.placements[0].first).toBe(0);
    expect(bake.placements[29].first).toBe(100);
  });

  it('a path borrowed from a morphing shape follows the morph frame by frame', () => {
    let doc = withShape(titled());
    doc = ok(setProps(doc, 'ring', { morphs: ['M0 0 L1 0 L1 1 L0 1 Z'] }));
    doc = ok(setKeyframes(doc, 'ring', 'morph', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 29, value: 1, ease: Ease.Linear }]));
    doc = ok(setTextPath(doc, 'title', { source: { kind: PathSourceKind.Clip, clip: 'ring' } }));
    const bake = textPathBake(findClip(doc, 'title')!.clip, doc, env);

    expect(bake.curves.length).toBeGreaterThan(10);
    expect(bake.curves[bake.index[0]].closed).toBe(true);
    expect(textPathBake(findClip(doc, 'title')!.clip, doc, env)).toEqual(bake);
  });

  it('booleans and alignment read from keyframes too', () => {
    let doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Line } }));
    doc = ok(setKeyframes(doc, 'title', textPathKey('reverse'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }]));
    doc = ok(setKeyframes(doc, 'title', textPathKey('align'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }]));
    const bake = textPathBake(findClip(doc, 'title')!.clip, doc, env);

    expect(bake.placements[0]).toMatchObject({ reverse: false, align: 0 });
    expect(bake.placements[10]).toMatchObject({ reverse: true, align: 1 });
  });
});

describe('the preview outline', () => {
  it('draws the path in frame pixels around the text box, moved with the clip', () => {
    let doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Line } }));
    const clip = findClip(doc, 'title')!.clip;
    const box = { left: (Number(clip.props.x) - Number(clip.props.width) / 2) * 1080, top: Number(clip.props.y) * 1080 };
    const [x, y] = textPathOutline(doc, clip, 0)!.points[0];
    expect(x).toBeCloseTo(box.left);
    expect(y).toBeCloseTo(box.top);

    doc = ok(setKeyframes(doc, 'title', 'x', [{ frame: 0, value: 0.1, ease: Ease.Linear }, { frame: 10, value: 0.1, ease: Ease.Linear }]));
    expect(textPathOutline(doc, findClip(doc, 'title')!.clip, 5)!.points[0][0]).toBeCloseTo(box.left + 108);
    expect(textPathOutline(titled(), findClip(titled(), 'title')!.clip, 0)).toBeNull();
  });
});

describe('text path compose', () => {
  it('lays the text out as one glyph per character, placed by the same pure function at every seek', () => {
    const doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Circle } }));
    const html = compose(doc);

    expect(html).toContain('id="tp-title"');
    expect(html.match(/class="tg"/g)).toHaveLength('Round we go'.length);
    expect(html).toContain(placeGlyphs.name);
    expect(html).toMatch(/hf-seek/);
  });

  it('keeps per-character animators on the glyphs', () => {
    let doc = ok(setTextPath(titled(), 'title', { source: { kind: PathSourceKind.Preset, preset: PathPreset.Wave } }));
    doc = ok(addAnimator(doc, 'title', 'a1', { unit: AnimatorUnit.Char, values: { y: 0.5 } }));
    const html = compose(doc);

    expect(html).toContain('id="ta-title"');
    expect(html).toMatch(/<span class="tg"><span class="tu" style="--p:0\.0556">R<\/span><\/span>/);
  });
});
