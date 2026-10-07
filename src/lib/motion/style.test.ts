import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { Ease } from './design';
import { JunctionKind } from './junction-model';
import { EffectKind } from './effects/registry';
import { Forbidden, STYLES, styleOf, styleProblems } from './style';
import { DEFAULT_STYLE, MotionStyle } from './style-model';

const SECOND = 30;

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

type Patch = Partial<MotionDoc['tracks'][number]['clips'][number]>;

function withClip(doc: MotionDoc, id: string, component: 'Title' | 'Image' | 'Particles' | 'Device3D', patch: Patch = {}, from = 0): MotionDoc {
  const added = must(addClip(doc, { component, from, durationInFrames: 3 * SECOND, props: {} }, id));
  return { ...added, tracks: added.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) };
}

const rise = { opacity: [{ frame: 0, value: 0, ease: STYLES[MotionStyle.AppleMinimal].eases.enter }, { frame: 12, value: 1, ease: STYLES[MotionStyle.AppleMinimal].eases.enter }] };
const effects = (doc: MotionDoc) => styleProblems(doc).map((p) => p.effect);
const blank = () => newMotionDoc(MotionFormat.Landscape);

describe('the Apple minimal style', () => {
  it('is the default style of every video', () => {
    expect(styleOf(blank())).toBe(DEFAULT_STYLE);
    expect(DEFAULT_STYLE).toBe(MotionStyle.AppleMinimal);
  });

  it('signs its eases: an expo-out entrance that never overshoots, an in-out move', () => {
    const { enter, move } = STYLES[MotionStyle.AppleMinimal].eases;

    expect(enter).toEqual([0.16, 1, 0.3, 1]);
    expect(move).toEqual([0.65, 0, 0.35, 1]);
  });

  it('text enters in 0.3 to 0.5 s with a short stagger, then holds', () => {
    const { seconds } = STYLES[MotionStyle.AppleMinimal];

    expect(seconds.enter).toEqual([0.3, 0.5]);
    expect(seconds.stagger).toBeGreaterThanOrEqual(0.05);
    expect(seconds.stagger).toBeLessThanOrEqual(0.15);
  });

  it('a fast fade-up title passes', () => {
    expect(effects(withClip(blank(), 't', 'Title', { keyframes: rise }))).toEqual([]);
  });

  it('names decorative particles', () => {
    expect(effects(withClip(blank(), 'p', 'Particles'))).toContain(Forbidden.Particles);
  });

  it('names a glow', () => {
    expect(effects(withClip(blank(), 't', 'Title', { effects: [{ id: 'g', kind: EffectKind.Glow, enabled: true, params: {} }] }))).toContain(Forbidden.Glow);
  });

  it('names a rotating title', () => {
    expect(effects(withClip(blank(), 't', 'Title', { keyframes: { rotateZ: [{ frame: 0, value: -20, ease: Ease.Standard }, { frame: 20, value: 0, ease: Ease.Standard }] } }))).toContain(Forbidden.Rotation);
  });

  it('a device that spins round is rotation, a slow hero turn is not', () => {
    const spin = { objectRotateY: [{ frame: 0, value: -330, ease: Ease.Standard }, { frame: 30, value: 0, ease: Ease.Standard }] };
    const turn = { objectRotateY: [{ frame: 0, value: -14, ease: Ease.Linear }, { frame: 90, value: 14, ease: Ease.Linear }] };

    expect(effects(withClip(blank(), 'd', 'Device3D', { keyframes: spin }))).toContain(Forbidden.Rotation);
    expect(effects(withClip(blank(), 'd', 'Device3D', { keyframes: turn }))).toEqual([]);
  });

  it('names an overshoot ease as bounce', () => {
    expect(effects(withClip(blank(), 't', 'Title', { keyframes: { scale: [{ frame: 0, value: 0.9, ease: Ease.Overshoot }, { frame: 18, value: 1, ease: Ease.Overshoot }] } }))).toContain(Forbidden.Bounce);
  });

  it('names text that flies across the frame, not text that rises a few percent', () => {
    const flies = { x: [{ frame: 0, value: -0.6, ease: Ease.Standard }, { frame: 20, value: 0, ease: Ease.Standard }] };
    const rises = { y: [{ frame: 0, value: 0.03, ease: Ease.Standard }, { frame: 27, value: 0, ease: Ease.Standard }] };

    expect(effects(withClip(blank(), 't', 'Title', { keyframes: flies }))).toContain(Forbidden.FlyingText);
    expect(effects(withClip(blank(), 't', 'Title', { keyframes: rises }))).toEqual([]);
  });

  it('names a wipe between scenes, not a dissolve', () => {
    expect(effects(withClip(blank(), 't', 'Title', { junction: { kind: JunctionKind.Wipe, durationInFrames: 12 } }))).toContain(Forbidden.Transition);
    expect(effects(withClip(blank(), 't', 'Title', { junction: { kind: JunctionKind.Crossfade, durationInFrames: 24 } }))).toEqual([]);
  });

  it('names a picture that stands still for more than a second, not one that keeps drifting', () => {
    const push = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 3 * SECOND, value: 1.04, ease: Ease.Linear }] };
    const stops = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: SECOND, value: 1.04, ease: Ease.Linear }] };

    expect(effects(withClip(blank(), 'i', 'Image'))).toContain(Forbidden.Still);
    expect(effects(withClip(blank(), 'i', 'Image', { keyframes: stops }))).toContain(Forbidden.Still);
    expect(effects(withClip(blank(), 'i', 'Image', { keyframes: push }))).toEqual([]);
  });

  it('a device that turns is moving, one parked at an angle stands still', () => {
    const angled = (start: number, end: number) => {
      const doc = withClip(blank(), 'd', 'Device3D');
      return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { ...c.props, startAngle: start, endAngle: end } })) })) };
    };
    const parked = angled(10, 10);
    const turning = angled(-14, 14);

    expect(effects(parked)).toContain(Forbidden.Still);
    expect(effects(turning)).toEqual([]);
  });

  it('names three things moving at once, not two', () => {
    const drift = { ...rise, scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 3 * SECOND, value: 1.04, ease: Ease.Linear }] };
    const two = withClip(withClip(blank(), 'a', 'Title', { keyframes: rise }), 'b', 'Image', { keyframes: drift });

    expect(effects(two)).toEqual([]);
    expect(effects(withClip(two, 'c', 'Title', { keyframes: rise }))).toContain(Forbidden.Crowded);
  });
});
