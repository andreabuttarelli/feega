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
const blank = (style = MotionStyle.AppleMinimal): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), style });

describe('the Apple minimal style', () => {
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

const at = (seconds: number) => Math.round(seconds * SECOND);
const track = (prop: string, from: number, to: number, frames = 3 * SECOND) => ({ [prop]: [{ frame: 0, value: from, ease: Ease.Linear }, { frame: frames, value: to, ease: Ease.Linear }] });
const film = () => blank(MotionStyle.LaunchFilm);
const beatMarkers = (doc: MotionDoc, every: number) => ({ ...doc, markers: Array.from({ length: 20 }, (_, i) => ({ frame: at(i * every), label: `beat ${i + 1}` })) });

describe('the launch film style', () => {
  it('is the default style of every new video', () => {
    expect(DEFAULT_STYLE).toBe(MotionStyle.LaunchFilm);
    expect(styleOf(newMotionDoc(MotionFormat.Landscape))).toBe(MotionStyle.LaunchFilm);
  });

  it('enters text in a third of a second or less, on an ease that snaps', () => {
    const { seconds, eases } = STYLES[MotionStyle.LaunchFilm];

    expect(seconds.enter[1]).toBeLessThanOrEqual(0.35);
    expect(eases.enter[0]).toBeLessThanOrEqual(0.2);
    expect(seconds.scene[1]).toBeLessThanOrEqual(2.5);
  });

  it('lets a device fly in turning and a word punch in from the side: energy is not off-style', () => {
    const doc = withClip(withClip(film(), 'd', 'Device3D', { keyframes: track('objectRotateY', -95, 8) }), 'w', 'Title', { keyframes: track('x', 0.2, -0.2, 12) });

    expect(effects(doc)).not.toContain(Forbidden.Rotation);
    expect(effects(doc)).not.toContain(Forbidden.FlyingText);
  });

  it('names a picture that holds still for more than half a second', () => {
    const late = { scale: [{ frame: at(1), value: 1, ease: Ease.Linear }, { frame: at(3), value: 1.2, ease: Ease.Linear }] };

    expect(effects(withClip(film(), 'i', 'Image', { keyframes: late }))).toContain(Forbidden.Still);
    expect(effects(withClip(film(), 'i', 'Image', { keyframes: track('zoom', 1, 1.6) }))).not.toContain(Forbidden.Still);
  });

  it('names a cut that misses the beat once the beats are marked, not one that lands on it', () => {
    const offBeat = withClip(withClip(beatMarkers(film(), 0.5), 'a', 'Title', { keyframes: rise }), 'b', 'Title', { keyframes: rise }, at(3.13));
    const onBeat = withClip(withClip(beatMarkers(film(), 0.5), 'a', 'Title', { keyframes: rise }), 'b', 'Title', { keyframes: rise }, at(3));

    expect(effects(offBeat)).toContain(Forbidden.OffBeat);
    expect(effects(onBeat)).not.toContain(Forbidden.OffBeat);
  });

  it('a cut on a half beat is on the music too', () => {
    const half = withClip(withClip(beatMarkers(film(), 0.5), 'a', 'Title', { keyframes: rise }), 'b', 'Title', { keyframes: rise }, at(3.25));

    expect(effects(half)).not.toContain(Forbidden.OffBeat);
  });

  it('names a video of six seconds or more with no peak, and finds the peak in a big 3D move', () => {
    const flat = [0, 3, 6].reduce((doc, s, i) => withClip(doc, `t${i}`, 'Title', { keyframes: rise }, at(s)), film());
    const peak = withClip(flat, 'd', 'Device3D', { keyframes: track('objectRotateY', -200, 0, 20) }, at(6));

    expect(effects(flat)).toContain(Forbidden.NoPeak);
    expect(effects(peak)).not.toContain(Forbidden.NoPeak);
  });

  it('a short clip has no peak to find', () => {
    expect(effects(withClip(film(), 't', 'Title', { keyframes: rise }))).not.toContain(Forbidden.NoPeak);
  });

  it('names a film cut together hard, not one whose junctions move or dissolve', () => {
    const still = [0, 1, 2, 3].reduce((doc, s, i) => withClip(doc, `s${i}`, 'Title', {}, at(s)), film());
    const flowing = [0, 1, 2, 3].reduce((doc, s, i) => withClip(doc, `s${i}`, 'Title', i % 2 ? { junction: { kind: JunctionKind.Crossfade, durationInFrames: 10 } } : { keyframes: track('scale', 1.3, 1, 8) }, at(s)), film());

    expect(effects(still)).toContain(Forbidden.RoughCut);
    expect(effects(flowing)).not.toContain(Forbidden.RoughCut);
  });

  it('allows a whip pan between scenes', () => {
    expect(effects(withClip(film(), 'w', 'Title', { junction: { kind: JunctionKind.PushLeft, durationInFrames: 8 }, keyframes: rise }))).not.toContain(Forbidden.Transition);
  });

  it('names text gone before it can be read: 0.4 s a word plus 0.6 s, 1.2 s at least for a phrase', () => {
    const shown = (text: string, seconds: number) => withClip(film(), 't', 'Title', { props: { text }, durationInFrames: at(seconds), keyframes: rise });

    expect(effects(shown('Turn clicks into revenue.', 1.5))).toContain(Forbidden.UnreadableText);
    expect(effects(shown('Turn clicks into revenue.', 2.2))).not.toContain(Forbidden.UnreadableText);
    expect(effects(shown('Links.', 0.5))).toContain(Forbidden.UnreadableText);
    expect(effects(shown('Links.', 1))).not.toContain(Forbidden.UnreadableText);
    expect(effects(shown('Two words', 1.4))).not.toContain(Forbidden.UnreadableText);
  });

  it('names a film made mostly of screenshots, not one with a blurred one behind live UI', () => {
    const shot = (blur: number) => withClip({ ...film(), durationInFrames: at(8) }, 'i', 'Image', { props: { assetId: 'shot', width: 1, height: 1 }, durationInFrames: at(8), keyframes: track('zoom', 1, 1.4), transform: { blur } });

    expect(effects(shot(0))).toContain(Forbidden.Screenshots);
    expect(effects(shot(20))).not.toContain(Forbidden.Screenshots);
  });

  it('names a film without its story: problem, solution, product and proof, claim', () => {
    const long = [0, 5, 10].reduce((doc, s, i) => withClip(doc, `t${i}`, 'Title', { keyframes: rise, props: { text: 'Go.' } }, at(s)), { ...film(), durationInFrames: at(15) });
    const told = { ...long, markers: ['problem', 'solution', 'proof', 'claim'].map((beat, i) => ({ frame: at(i * 3), label: `story: ${beat}` })) };
    const half = { ...long, markers: told.markers.slice(0, 2) };

    expect(effects(long)).toContain(Forbidden.MissingStoryBeat);
    expect(effects(half)).toContain(Forbidden.MissingStoryBeat);
    expect(effects(told)).not.toContain(Forbidden.MissingStoryBeat);
  });
});
