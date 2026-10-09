import { describe, expect, it } from 'vitest';
import { installEngine, testTimeline } from '../engine/testing';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from '../hyperframes/compose';
import { setExpression } from '../expression/ops';
import { EFFECTS, EFFECT_KINDS, EffectKind } from './registry';
import { addEffect, removeEffect, setEffect } from './ops';
import { effectKey } from './model';
import { effectLayer, effectTimeline } from './render';
import { addModifier } from '../shape/ops';
import { ModifierKind } from '../shape/modifiers';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = () => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 30, durationInFrames: 60 }, 'card'));
const clipOf = (doc: MotionDoc) => findClip(doc, 'card')!.clip;
const frame = { width: 1920, height: 1080, fps: 30 };
const plain = (c: string) => c;

describe('layer effects', () => {
  it('adds effects in order with their defaults, and a parse round trip keeps them', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.BrightnessContrast, 'e1', { brightness: 1.4 }));
    doc = ok(addEffect(doc, 'card', EffectKind.GaussianBlur, 'e2'));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(parsed.ok && clipOf(parsed.doc).effects).toEqual([
      { id: 'e1', kind: EffectKind.BrightnessContrast, enabled: true, params: { brightness: 1.4, contrast: 1 } },
      { id: 'e2', kind: EffectKind.GaussianBlur, enabled: true, params: { radius: 8 } }
    ]);
  });

  it('refuses a value out of range, an unknown param and a bad colour', () => {
    expect(addEffect(base(), 'card', EffectKind.GaussianBlur, 'e1', { radius: 999 })).toMatchObject({ ok: false });
    expect(addEffect(base(), 'card', EffectKind.GaussianBlur, 'e1', { spread: 1 })).toMatchObject({ ok: false, error: expect.stringContaining('spread') });
    expect(addEffect(base(), 'card', EffectKind.Glow, 'e1', { color: 'red' })).toMatchObject({ ok: false });
  });

  it('reorders, toggles and removes; removing drops its keyframes and expressions', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.BlackWhite, 'a'));
    doc = ok(addEffect(doc, 'card', EffectKind.Vignette, 'b'));
    doc = ok(setEffect(doc, 'card', 'b', { index: 0, enabled: false }));
    expect(clipOf(doc).effects.map((e) => [e.id, e.enabled])).toEqual([['b', false], ['a', true]]);

    doc = ok(setKeyframes(doc, 'card', effectKey('a', 'amount'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 1, ease: Ease.Linear }]));
    doc = ok(setExpression(doc, 'card', effectKey('b', 'amount'), 'time / 2'));
    doc = ok(removeEffect(doc, 'card', 'a'));
    doc = ok(removeEffect(doc, 'card', 'b'));
    expect(clipOf(doc)).toMatchObject({ effects: [], keyframes: {}, expressions: {} });
  });

  it('chains enabled effects into one filter in stack order, svg ones by reference', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.BrightnessContrast, 'a', { brightness: 1.2 }));
    doc = ok(addEffect(doc, 'card', EffectKind.Stroke, 'b'));
    doc = ok(addEffect(doc, 'card', EffectKind.GaussianBlur, 'c', { radius: 4 }));
    doc = ok(setEffect(doc, 'card', 'c', { enabled: false }));
    const html = effectLayer(clipOf(doc), frame, plain, '<i></i>');

    expect(html).toContain('filter:brightness(1.2) contrast(1) url(#ef-card-b)');
    expect(html).toContain('<filter id="ef-card-b"');
    expect(html).toContain('feMorphology');
    expect(html).not.toContain('blur(4px)');
    expect(html).toContain('<i></i>');
  });

  it('an svg filter over a known paint area covers that area and the reach of the effect, not the whole frame; an animated one its widest reach', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.Stroke, 'b', { width: 12 }));
    const keyed = ok(setKeyframes(doc, 'card', effectKey('b', 'width'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 30, ease: Ease.Linear }]));
    const area = { left: 100, top: 200, width: 300, height: 100 };

    expect(effectLayer(clipOf(doc), frame, plain, '', area)).toContain('<filter id="ef-card-b" filterUnits="userSpaceOnUse" x="88" y="188" width="324" height="124"');
    expect(effectLayer(clipOf(keyed), frame, plain, '', area)).toContain('<filter id="ef-card-b" filterUnits="userSpaceOnUse" x="40" y="140" width="420" height="220"');
    expect(effectLayer(clipOf(doc), frame, plain, '')).toContain('x="-25%" y="-25%" width="150%" height="150%"');
  });

  it.each([EffectKind.DropShadow, EffectKind.Glow, EffectKind.GaussianBlur])('over a known paint area %s becomes an svg filter bounded to it, not a css filter over the whole layer', (kind) => {
    const doc = ok(addEffect(base(), 'card', kind, 'd'));
    const html = effectLayer(clipOf(doc), frame, plain, '', { left: 100, top: 200, width: 300, height: 100 });

    expect(html).toContain('style="filter:url(#ef-card-d)"');
    expect(html).toMatch(/<filter id="ef-card-d" filterUnits="userSpaceOnUse"/);
    expect(effectLayer(clipOf(doc), frame, plain, '')).not.toContain('<filter');
  });

  it('a clip without effects keeps its markup', () => {
    expect(effectLayer(clipOf(base()), frame, plain, '<i></i>')).toBe('<i></i>');
  });

  it('every effect renders at its defaults to a filter', () => {
    for (const kind of EFFECT_KINDS) {
      const doc = ok(addEffect(base(), 'card', kind, 'e'));
      expect(effectLayer(clipOf(doc), frame, plain, '')).toMatch(/filter:/);
      expect(EFFECTS[kind].params.length).toBeGreaterThan(0);
    }
  });

  it('a keyframed param becomes per-frame sets that land on the sampled value whatever order frames are sought in', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.GaussianBlur, 'a', { radius: 0 }));
    doc = ok(setKeyframes(doc, 'card', effectKey('a', 'radius'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 30, ease: Ease.Linear }]));
    const sets = effectTimeline(clipOf(doc), frame, plain);
    const target = { style: { filter: 'blur(0px)' } };
    const tl = testTimeline(installEngine());
    for (const s of sets) {
      tl.set(target.style, { filter: String(s.vars.filter) }, s.at);
    }
    const frames = Array.from({ length: 60 }, (_, i) => 30 + i).sort((a, b) => Math.sin(a * 12.9898) - Math.sin(b * 12.9898));
    for (const f of frames) {
      tl.seek(f / 30);
      expect(target.style.filter).toBe(`blur(${Math.min(30, f - 30)}px)`);
    }
  });

  it('svg params animate as attribute sets on the primitive, grain re-seeds every frame', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.Noise, 'n'));
    doc = ok(addEffect(doc, 'card', EffectKind.Stroke, 's'));
    doc = ok(setKeyframes(doc, 'card', effectKey('s', 'width'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 10, ease: Ease.Linear }]));
    const sets = effectTimeline(clipOf(doc), frame, plain);

    expect(sets.filter((s) => s.target === '#ef-card-n-0' && 'seed' in (s.vars.attr as object))).toHaveLength(59);
    expect(sets.find((s) => s.target === '#ef-card-s-0' && Math.round(s.at * 30 + 0.5) === 35)?.vars).toEqual({ attr: { radius: 5 } });
  });

  it('grain is computed once on a small seamless tile and repeated, not over the whole layer', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.Noise, 'n'));
    const html = effectLayer(clipOf(doc), frame, plain, '');

    expect(html).toMatch(/<feTurbulence id="ef-card-n-0"[^>]* x="0" y="0" width="256" height="256" stitchTiles="stitch" result="tile"/);
    expect(html).toMatch(/<feTile [^>]*in="tile" result="grain"/);
  });

  it('a still clip with no animated effect needs no timeline work', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.Tint, 't', { white: '#ff0000' }));
    expect(effectTimeline(clipOf(doc), frame, plain)).toEqual([]);
  });

  it('compose wraps the clip content in the effect layer inside its transform, and timeline sets are on the paused timeline', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.DropShadow, 'd'));
    doc = ok(setExpression(doc, 'card', effectKey('d', 'angle'), 'time * 90'));
    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

    expect(html).toContain('id="ef-card"');
    expect(html).toMatch(/tl\.set\("#ef-card-d-0",\{"attr":\{"dx"/);
  });

  it('a shape filters only where it draws over its clip, repeated copies included; other clips keep the whole frame', () => {
    const stroked = ok(addEffect(base(), 'card', EffectKind.Stroke, 's'));
    const repeated = ok(addModifier(stroked, 'card', ModifierKind.Repeater, 'm'));
    const title = ok(addEffect(ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 30 }, 'card')), 'card', EffectKind.Stroke, 's'));
    const region = (doc: MotionDoc) => /<filter id="ef-card-s"[^>]*>/.exec(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} }))?.[0] ?? '';
    const width = (doc: MotionDoc) => Number(/ width="([\d.]+)"/.exec(region(doc))?.[1]);

    expect(region(stroked)).toContain('filterUnits="userSpaceOnUse"');
    expect(width(stroked)).toBeLessThan(1920);
    expect(width(repeated)).toBeGreaterThan(width(stroked));
    expect(region(title)).toContain('x="-25%"');
  });
});
