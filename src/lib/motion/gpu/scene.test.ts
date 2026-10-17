// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { BlendMode } from '../blend';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { Ease, TransitionKind } from '../design';
import { motionEngine } from '../engine/engine';
import { addClip, setKeyframes, setTransition, Side, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { PaintKind } from './paint-of';
import { compileScene, frameAt, resolved, type Drawn } from './scene';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 90 }, 'bg'));
const withCard = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: 90, props: { x: 0.2, y: 0.5, width: 0.1, height: 0.1 } }, 'card'));
const moving = must(setKeyframes(withCard, 'card', 'x', [{ frame: 30, value: 0, ease: Ease.Linear }, { frame: 60, value: 0.5, ease: Ease.Linear }]));
const titled = must(addClip(moving, { component: 'Title', from: 30, durationInFrames: 30, props: { text: 'hi' } }, 'title'));

const withClip = (doc: MotionDoc, id: string, patch: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) });

const scene = (doc: MotionDoc) => compileScene(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' }));
const drawn = (doc: MotionDoc, t: number) => frameAt(scene(doc), t);
const byClip = (items: Drawn[], clip: string) => items.find((d) => d.clip === clip);
const left = (d: Drawn | undefined) => Math.min(...(d?.quad ?? []).map(([x]) => x));

describe('compileScene', () => {
  it('paints a brand background, a shape and a title in stacking order', () => {
    const kinds = scene(titled).layers.map((l) => [l.clip, l.paint.kind]);

    expect(kinds).toEqual([
      ['bg', PaintKind.Fill],
      ['card', PaintKind.Shape],
      ['title', PaintKind.Html]
    ]);
  });

  it('reads the root background from the composed page', () => {
    expect(scene(base).background).toBe(FEEGA_TOKENS.colors['brand.background']);
  });
});

describe('frameAt', () => {
  it('places a shape where its box is', () => {
    const card = byClip(drawn(withCard, 0), 'card');

    expect(left(card)).toBeCloseTo(0.15 * 1920, 0);
  });

  it('moves a keyframed shape with the same engine the HTML player runs', () => {
    const t = 45 / 30;
    const expected = 0.5 * 1920 * motionEngine({ document } as unknown as Window & Record<string, unknown>).parseEase('none')(0.5);

    expect(left(byClip(drawn(moving, t), 'card')) - 0.15 * 1920).toBeCloseTo(expected, 0);
  });

  it('draws a clip only inside its time window', () => {
    expect(byClip(drawn(titled, 0.5), 'title')).toBeUndefined();
    expect(byClip(drawn(titled, 1.5), 'title')).toBeDefined();
    expect(byClip(drawn(titled, 2.5), 'title')).toBeUndefined();
  });

  it('fades a clip in through its transition', () => {
    const faded = must(setTransition(withCard, 'card', Side.In, { kind: TransitionKind.Fade, durationInFrames: 30 }));

    expect(byClip(drawn(faded, 0), 'card')?.opacity).toBeCloseTo(0);
    expect(byClip(drawn(faded, 0.5), 'card')?.opacity).toBeGreaterThan(0);
    expect(byClip(drawn(faded, 2), 'card')?.opacity).toBeCloseTo(1);
  });

  it('blurs a clip by its blur transition, in screen pixels', () => {
    const blurred = must(setTransition(withCard, 'card', Side.In, { kind: TransitionKind.Blur, durationInFrames: 30 }));

    expect(byClip(drawn(blurred, 0), 'card')?.blur).toBeCloseTo(24);
    expect(byClip(drawn(blurred, 2), 'card')?.blur).toBeCloseTo(0);
  });

  it('carries the blend mode of the layer', () => {
    const screen = withClip(withCard, 'card', { blend: BlendMode.Screen });

    expect(byClip(drawn(screen, 0), 'card')?.blend).toBe('screen');
  });

  it('clips a wipe to the revealed part of the frame', () => {
    const wiped = must(setTransition(withCard, 'card', Side.In, { kind: TransitionKind.Wipe, durationInFrames: 30 }));

    expect(byClip(drawn(wiped, 0), 'card')?.clips.length).toBe(1);
  });
});

describe('resolved', () => {
  it('falls back to the default of an unset custom property', () => {
    expect(resolved('scale(var(--kc-zoom, 1))', new Map())).toBe('scale(1)');
  });

  it('reads a custom property set by an ancestor', () => {
    expect(resolved('scale(var(--kc-zoom, 1))', new Map([['--kc-zoom', '1.4']]))).toBe('scale(1.4)');
  });

  it('turns a fraction of 100% into a percentage', () => {
    expect(resolved('calc(var(--kc-focusX, 0.25) * 100%) calc(var(--kc-focusY, 0.5) * 100%)', new Map())).toBe('25% 50%');
  });
});
