import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { Ease } from './design';
import { JunctionKind } from './junction-model';
import { EffectKind } from './effects/registry';
import { Forbidden, STYLES, styleOf, styleProblems } from './style';
import { SEVERITY, Severity } from './direction';
import { DEFAULT_STYLE, MOTION_STYLES, MotionStyle, STYLE_EASES } from './style-model';
import { writeComponent } from './custom/ops';
import type { Keyframe } from './keyframes';
import supasito from './fixtures/supasito-v1.json';
import { builtinTemplate } from './template/builtins';
import { insertTemplate } from './template/library';

const SECOND = 30;

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SHORT_TEXT: Partial<Record<string, { text: string }>> = { Title: { text: 'Launch' } };

type Patch = Partial<MotionDoc['tracks'][number]['clips'][number]>;

function withClip(doc: MotionDoc, id: string, component: 'Title' | 'Text' | 'Logo' | 'Image' | 'Particles' | 'Device3D', patch: Patch = {}, from = 0): MotionDoc {
  const added = must(addClip(doc, { component, from, durationInFrames: 3 * SECOND, props: { ...SHORT_TEXT[component] } }, id));
  return { ...added, tracks: added.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) };
}

const rise = { opacity: [{ frame: 0, value: 0, ease: STYLES[MotionStyle.AppleMinimal].eases.enter }, { frame: 12, value: 1, ease: STYLES[MotionStyle.AppleMinimal].eases.enter }] };
const effects = (doc: MotionDoc) => styleProblems(doc).map((p) => p.effect);
const blank = (style = MotionStyle.AppleMinimal): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), style });

describe('the Apple minimal style', () => {
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
    const two = withClip(withClip(blank(), 'a', 'Title', { keyframes: rise, props: { text: 'Launch', size: 0.04 } }), 'b', 'Image', { keyframes: drift });

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
    expect(eases.enter).toBe(Ease.Enter);
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

  it('cuts on the beat, never on a half beat', () => {
    const half = withClip(withClip(beatMarkers(film(), 0.5), 'a', 'Title', { keyframes: rise }), 'b', 'Title', { keyframes: rise }, at(3.25));

    expect(effects(half)).toContain(Forbidden.OffBeat);
  });

  it('holds every scene 2 to 4 s: fewer ideas, never faster cuts', () => {
    expect(STYLES[MotionStyle.LaunchFilm].seconds.scene).toEqual([2, 5]);
  });

  it('names a scene cut shorter than two seconds, not one that holds', () => {
    const scene = (seconds: number) => {
      const doc = must(insertTemplate(film(), builtinTemplate('builtin:launch-word-burst')!, { from: 0, newId: () => 'ws' }));
      return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.component === 'Precomp' ? { ...c, durationInFrames: at(seconds) } : c)) })) };
    };

    expect(effects(scene(1))).toContain(Forbidden.Rushed);
    expect(effects(scene(2.5))).not.toContain(Forbidden.Rushed);
  });

  it('names a video of six seconds or more with no peak, and finds the peak in a big 3D move', () => {
    const flat = [0, 3, 6].reduce((doc, s, i) => withClip(doc, `t${i}`, 'Title', { keyframes: rise }, at(s)), film());
    const peak = withClip(flat, 'd', 'Device3D', { keyframes: track('objectRotateY', -200, 0, 20) }, at(6));

    expect(effects(flat)).toContain(Forbidden.NoPeak);
    expect(effects(peak)).not.toContain(Forbidden.NoPeak);
  });

  it('finds the peak in a device turning 90° or more between its start and end angles', () => {
    const flat = [0, 3, 6].reduce((doc, s, i) => withClip(doc, `t${i}`, 'Title', { keyframes: rise }, at(s)), film());
    const turned = (start: number, end: number) => {
      const doc = withClip(flat, 'd', 'Device3D', {}, at(6));
      return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'd' ? { ...c, props: { ...c.props, startAngle: start, endAngle: end } } : c)) })) };
    };

    expect(effects(turned(-100, 0))).not.toContain(Forbidden.NoPeak);
    expect(effects(turned(-20, 40))).toContain(Forbidden.NoPeak);
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

  it('names text gone before it can be read plus a second: 0.4 s a word plus 0.6 s, 1.2 s at least for a phrase, then 1 s', () => {
    const shown = (text: string, seconds: number) => withClip(film(), 't', 'Title', { props: { text }, durationInFrames: at(seconds), keyframes: rise });

    expect(effects(shown('Turn clicks into revenue.', 3.1))).toContain(Forbidden.ReadingTime);
    expect(effects(shown('Turn clicks into revenue.', 3.3))).not.toContain(Forbidden.ReadingTime);
    expect(effects(shown('Links.', 1.9))).toContain(Forbidden.ReadingTime);
    expect(effects(shown('Links.', 2.1))).not.toContain(Forbidden.ReadingTime);
    expect(effects(shown('Two words', 2.5))).not.toContain(Forbidden.ReadingTime);
  });

  it('names a film made mostly of screenshots, not one with a blurred one behind live UI', () => {
    const shot = (blur: number) => withClip({ ...film(), durationInFrames: at(8) }, 'i', 'Image', { props: { assetId: 'shot', width: 1, height: 1 }, durationInFrames: at(8), keyframes: track('zoom', 1, 1.4), transform: { blur } });

    expect(effects(shot(0))).toContain(Forbidden.Screenshots);
    expect(effects(shot(20))).not.toContain(Forbidden.Screenshots);
  });

  it('names one sharp screenshot in the foreground, however short', () => {
    const shot = (transform: Patch['transform']) => withClip({ ...film(), durationInFrames: at(8) }, 'i', 'Image', { props: { assetId: 'shot', width: 1, height: 1 }, durationInFrames: at(0.5), keyframes: track('zoom', 1, 1.1, at(0.5)), transform });

    expect(effects(shot(undefined))).toContain(Forbidden.Screenshots);
    expect(effects(shot({ blur: 5 }))).toContain(Forbidden.Screenshots);
    expect(effects(shot({ opacity: 0.2 }))).not.toContain(Forbidden.Screenshots);
  });

  it('names the supasito v1 screenshots hidden inside its scenes', () => {
    const problems = styleProblems(supasito as unknown as MotionDoc).filter((p) => p.effect === Forbidden.Screenshots);

    expect(problems.map((p) => p.at)).toEqual(expect.arrayContaining([2, 4, 6, 7]));
    expect(SEVERITY[Forbidden.Screenshots]).toBe(Severity.Blocking);
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

describe('a title owns the frame, the scene comes after', () => {
  const film = (style = MotionStyle.LaunchFilm): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), style, durationInFrames: 12 * SECOND });
  const title = (doc: MotionDoc, from: number, text = 'Ship faster.') => withClip(doc, `t${from}`, 'Title', { props: { text, size: 0.11 } }, from * SECOND);
  const device = (doc: MotionDoc, from: number) => withClip(doc, `d${from}`, 'Device3D', {}, from * SECOND);

  it('a title alone, then the scene, passes', () => {
    expect(effects(device(title(film(), 0), 3))).not.toContain(Forbidden.TextOverScene);
  });

  it('names a headline laid over a device or UI scene', () => {
    expect(effects(device(title(film(), 0), 1))).toContain(Forbidden.TextOverScene);
    expect(effects(device(title(film(MotionStyle.AppleMinimal), 0), 1))).toContain(Forbidden.TextOverScene);
  });

  it('tells the agent to give the line its own title card', () => {
    const found = styleProblems(device(title(film(), 0), 1)).find((p) => p.effect === Forbidden.TextOverScene);

    expect(found?.detail).toMatch(/own title card/);
  });

  it('a small label inside the scene is not a headline', () => {
    const label = withClip(device(film(), 0), 'l', 'Text', { props: { text: 'Saved', size: 0.03 } }, SECOND);

    expect(effects(label)).not.toContain(Forbidden.TextOverScene);
  });

  it('the logo lockup with its address is not a scene', () => {
    const lockup = withClip(title(film(), 0, 'feega.app'), 'logo', 'Logo', { props: { assetId: 'brandlogo' } });

    expect(effects(lockup)).not.toContain(Forbidden.TextOverScene);
  });

  it('names a video carried by text: more words than seconds', () => {
    const wordy = [0, 3, 6, 9].reduce((doc, s) => title(doc, s, 'One more line of copy here'), film());
    const sparse = [0, 6].reduce((doc, s) => title(doc, s, 'Ship faster.'), film());

    expect(effects(wordy)).toContain(Forbidden.TooMuchText);
    expect(effects(sparse)).not.toContain(Forbidden.TooMuchText);
  });

  it('warns in the launch film and Apple minimal, not in the UI morph reel', () => {
    expect(STYLES[MotionStyle.LaunchFilm].forbidden).toEqual(expect.arrayContaining([Forbidden.TextOverScene, Forbidden.TooMuchText]));
    expect(STYLES[MotionStyle.AppleMinimal].forbidden).toEqual(expect.arrayContaining([Forbidden.TextOverScene, Forbidden.TooMuchText]));
    expect(STYLES[MotionStyle.UiMorph].forbidden).not.toContain(Forbidden.TextOverScene);
    expect(SEVERITY[Forbidden.TextOverScene]).toBe(Severity.Warning);
    expect(SEVERITY[Forbidden.TooMuchText]).toBe(Severity.Warning);
  });
});

describe('weak and bouncy eases', () => {
  const fade = (ease: Keyframe['ease'], frames = 12) => ({ opacity: [{ frame: 0, value: 0, ease }, { frame: frames, value: 1, ease }] });
  const weak = (doc: MotionDoc) => effects(doc).includes(Forbidden.WeakEase);
  const coded = (js: string) => must(writeComponent(blank(), 'Card', { source: { html: '<b></b>', css: '', js }, propsSchema: { type: 'object', properties: {} } }));

  it('names a linear entrance and a sine-like curve', () => {
    expect(weak(withClip(blank(), 't', 'Title', { keyframes: fade(Ease.Linear) }))).toBe(true);
    expect(weak(withClip(blank(), 't', 'Title', { keyframes: fade([0.37, 0, 0.63, 1]) }))).toBe(true);
  });

  it('lets the house curves through', () => {
    for (const ease of [Ease.Enter, Ease.Standard, Ease.Exit]) {
      expect(weak(withClip(blank(), 't', 'Title', { keyframes: fade(ease) }))).toBe(false);
    }
  });

  it('lets a linear drift through: camera, not an entrance', () => {
    const drift = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 3 * SECOND, value: 1.04, ease: Ease.Linear }] };
    expect(weak(withClip(blank(), 'i', 'Image', { keyframes: drift }))).toBe(false);
  });

  it('names a component that tweens on sine or springs on elastic, not one on the house curves or a linear driver', () => {
    expect(weak(coded("tl.to(root, { x: 9, ease: 'sine.inOut' });"))).toBe(true);
    expect(weak(coded('tl.to(root, { x: 9, ease: "elastic.out(1,0.4)" });'))).toBe(true);
    expect(weak(coded("tl.to(root, { x: 9, ease: 'back.out(1.7)' });"))).toBe(true);
    expect(weak(coded("tl.to(root, { x: 9, ease: 'feega.out' }); tl.to({}, { duration: 4, ease: 'none' });"))).toBe(false);
  });

  it('is a warning every style runs', () => {
    for (const style of MOTION_STYLES) {
      expect(STYLES[style].forbidden).toContain(Forbidden.WeakEase);
    }
    expect(SEVERITY[Forbidden.WeakEase]).toBe(Severity.Warning);
  });

  it('every style enters on feega.out and moves on feega.inOut', () => {
    for (const style of MOTION_STYLES) {
      expect(STYLE_EASES[style]).toEqual({ enter: Ease.Enter, move: Ease.Standard });
    }
  });
});
