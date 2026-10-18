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
import { compileScene, frameAt, resolved, strokePad, type Drawn } from './scene';

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
      ['title', PaintKind.Text]
    ]);
  });

  it('reads the root background from the composed page', () => {
    expect(scene(base).background).toBe(FEEGA_TOKENS.colors['brand.background']);
  });
});

describe('backdrop groups', () => {
  it('keeps a liquid blob and everything it refracts as one HTML layer', () => {
    const blob = must(addClip(withCard, { component: 'LiquidBlob', from: 0, durationInFrames: 90 }, 'blob'));
    const layers = scene(blob).layers.map((l) => [l.clip, l.paint.kind]);

    expect(layers).toContainEqual(['blob', PaintKind.Html]);
    expect(layers.map(([c]) => c)).not.toContain('card');
  });
});

describe('strokePad', () => {
  it('leaves room for half of the widest stroke around a shape', () => {
    expect(strokePad('<svg><path style="stroke-width:12"/><path stroke-width="30"/></svg>')).toBe(16);
    expect(strokePad('<svg><path/></svg>')).toBe(0);
  });
});

describe('effects', () => {
  it('draws a gaussian blur effect natively, in screen pixels', () => {
    const blurred = withClip(withCard, 'card', { effects: [{ id: 'e1', kind: 'gaussian-blur', enabled: true, params: { radius: 12 } }] } as never);
    const card = byClip(drawn(blurred, 0), 'card');

    expect(card?.paint.kind).toBe(PaintKind.Shape);
    expect(card?.blur).toBeGreaterThan(0);
  });

  it('skips a layer that paints nothing, like an audio clip', () => {
    const audio = must(addClip(withCard, { component: 'Audio', from: 0, durationInFrames: 30 }, 'sound'));

    expect(scene(audio).layers.map((l) => l.clip)).not.toContain('sound');
  });
});

describe('text', () => {
  const twoLines = must(addClip(base, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'one\ntwo' } }, 'title'));

  it('draws each revealed line of a title as its own part, so lines move on their own', () => {
    const parts = scene(twoLines).layers.filter((l) => l.clip === 'title');

    expect(parts.map((p) => p.paint.kind)).toEqual([PaintKind.Text, PaintKind.Text]);
    expect(parts.map((p) => p.links[p.links.length - 1].el.id)).toEqual(['li-title-0', 'li-title-1']);
  });

  it('draws a paragraph as one part', () => {
    const text = must(addClip(base, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a paragraph' } }, 'body'));

    expect(scene(text).layers.filter((l) => l.clip === 'body').map((l) => l.paint.kind)).toEqual([PaintKind.Text]);
  });
});

describe('animated content', () => {
  it('leaves a title whose type is keyframed to the HTML engine, a still raster would not move', () => {
    const titled2 = must(addClip(base, { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 'title'));
    const heavier = must(setKeyframes(titled2, 'title', 'weight', [{ frame: 0, value: 300, ease: Ease.Linear }, { frame: 30, value: 800, ease: Ease.Linear }]));

    expect(scene(heavier).layers.filter((l) => l.clip === 'title').map((l) => l.paint.kind)).toEqual([PaintKind.Html]);
  });

  it('keeps a title whose box only moves on the GPU', () => {
    const titled2 = must(addClip(base, { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'hi' } }, 'title'));
    const moved = must(setKeyframes(titled2, 'title', 'x', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 0.2, ease: Ease.Linear }]));

    expect(scene(moved).layers.filter((l) => l.clip === 'title').map((l) => l.paint.kind)).toEqual([PaintKind.Text]);
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
