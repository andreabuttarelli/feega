import { boxOf, type Box, type Placement } from '../layout';
import type { MotionClip } from '../doc';
import { Source, TRANSFORM, ValueKind, animProp, easeName, sampleTrack, type EaseSpec, type Keyframe, type SceneKey, type TransformKey } from '../keyframes';
import { css, js, px } from './html';
import type { Vars } from './templates';

type Frame = { width: number; height: number; fps: number };

enum Wrapper {
  Perspective = 'kp',
  Transform = 'kf',
  Scale = 'ks'
}

type Channel = { wrapper: Wrapper; gsap: string; out: (value: number, frame: Frame) => number | string };

const same = (v: number) => v;

const CHANNELS: Record<Exclude<TransformKey, 'anchorX' | 'anchorY'>, Channel> = {
  x: { wrapper: Wrapper.Transform, gsap: 'x', out: (v, f) => round(v * f.width) },
  y: { wrapper: Wrapper.Transform, gsap: 'y', out: (v, f) => round(v * f.height) },
  z: { wrapper: Wrapper.Transform, gsap: 'z', out: same },
  scale: { wrapper: Wrapper.Scale, gsap: 'scale', out: same },
  scaleX: { wrapper: Wrapper.Transform, gsap: 'scaleX', out: same },
  scaleY: { wrapper: Wrapper.Transform, gsap: 'scaleY', out: same },
  rotateX: { wrapper: Wrapper.Transform, gsap: 'rotationX', out: same },
  rotateY: { wrapper: Wrapper.Transform, gsap: 'rotationY', out: same },
  rotateZ: { wrapper: Wrapper.Transform, gsap: 'rotation', out: same },
  skewX: { wrapper: Wrapper.Transform, gsap: 'skewX', out: same },
  skewY: { wrapper: Wrapper.Transform, gsap: 'skewY', out: same },
  perspective: { wrapper: Wrapper.Perspective, gsap: 'perspective', out: (v) => px(v) },
  opacity: { wrapper: Wrapper.Transform, gsap: 'opacity', out: same },
  blur: { wrapper: Wrapper.Transform, gsap: 'filter', out: (v) => `blur(${px(v)})` }
};

export const ANIMATE_CSS = '.kp{position:absolute;inset:0}.kf,.ks{position:absolute;inset:0;transform-style:preserve-3d;backface-visibility:visible;will-change:transform,opacity,filter}';

export type KfTween = { target: string; from: Vars; to: Vars; at: number; duration: number; ease: string };

type Lane = { target: string; prop: string; track: Keyframe[]; out: (value: Keyframe['value']) => number | string };

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const target = (wrapper: Wrapper, clip: MotionClip) => `#${wrapper}-${clip.id}`;

const CSS_VAR_PREFIX = '--kc-';

export function cssVar(key: string): string {
  return `${CSS_VAR_PREFIX}${key}`;
}

export function isAnimated(clip: MotionClip): boolean {
  return Object.keys(clip.transform).length > 0 || Object.keys(clip.keyframes).length > 0;
}

type LaneInput = { clip: MotionClip; key: string; track: Keyframe[]; frame: Frame; resolve: (color: string) => string };

const LANE: Record<Source, (input: LaneInput) => Lane[]> = {
  [Source.Transform]: ({ clip, key, track, frame }) => {
    const channel = CHANNELS[key as keyof typeof CHANNELS];
    return [{ target: target(channel.wrapper, clip), prop: channel.gsap, track, out: (v) => channel.out(Number(v), frame) }];
  },
  [Source.Prop]: ({ clip, key, track, resolve }) => [{ target: target(Wrapper.Scale, clip), prop: cssVar(key), track, out: (v) => resolve(String(v)) }],
  [Source.Scene]: () => []
};

function lanes(clip: MotionClip, frame: Frame, resolve: (color: string) => string): Lane[] {
  return Object.entries(clip.keyframes).flatMap(([key, track]) => {
    const prop = animProp(clip.component, key);
    return prop ? LANE[prop.source]({ clip, key, track, frame, resolve }) : [];
  });
}

export function keyframeTweens(clip: MotionClip, frame: Frame, resolve: (color: string) => string): KfTween[] {
  return lanes(clip, frame, resolve).flatMap((lane) =>
    lane.track.slice(0, -1).map((k, i) => {
      const next = lane.track[i + 1];
      return {
        target: lane.target,
        from: { [lane.prop]: lane.out(k.value) },
        to: { [lane.prop]: lane.out(next.value) },
        at: (clip.from + k.frame) / frame.fps,
        duration: (next.frame - k.frame) / frame.fps,
        ease: easeName(k.ease)
      };
    })
  );
}

function holds(clip: MotionClip, frame: Frame, resolve: (color: string) => string): string[] {
  const start = clip.from / frame.fps;
  return lanes(clip, frame, resolve).map((lane) => `tl.set(${js(lane.target)},${js({ [lane.prop]: lane.out(lane.track[0].value) })},${start});`);
}

function initial(clip: MotionClip, frame: Frame, resolve: (color: string) => string): string[] {
  const vars = new Map<string, Vars>();
  const put = (t: string, prop: string, value: number | string) => vars.set(t, { ...vars.get(t), [prop]: value });

  for (const [key, channel] of Object.entries(CHANNELS) as [keyof typeof CHANNELS, Channel][]) {
    const track = clip.keyframes[key];
    const value = track?.length ? Number(track[0].value) : clip.transform[key];
    if (value === undefined || channel.wrapper === Wrapper.Perspective) {
      continue;
    }
    put(target(channel.wrapper, clip), channel.gsap, channel.out(value, frame));
  }
  for (const lane of lanes(clip, frame, resolve).filter((l) => l.prop.startsWith(CSS_VAR_PREFIX))) {
    put(lane.target, lane.prop, lane.out(lane.track[0].value));
  }
  return [...vars].map(([t, v]) => `gsap.set(${js(t)},${js(v)});`);
}

function bezierEases(clips: MotionClip[]): string[] {
  const curves = new Map<string, EaseSpec>();
  for (const k of clips.flatMap((c) => Object.values(c.keyframes).flat())) {
    if (typeof k.ease !== 'string') {
      curves.set(easeName(k.ease), k.ease);
    }
  }
  return [...curves].map(([name, ease]) => `gsap.registerEase(${js(name)},function(p){return KF_SAMPLE([{frame:0,value:0,ease:${js(ease)}},{frame:1,value:1,ease:"linear"}],p);});`);
}

export function animationScript(clips: MotionClip[], frame: Frame, resolve: (color: string) => string): { setup: string; timeline: string } {
  const animated = clips.filter(isAnimated);
  const eases = bezierEases(animated);
  const sampler = eases.length ? `const KF_SAMPLE=(${sampleTrack.toString()});` : '';
  const setup = [sampler, ...eases, ...animated.flatMap((c) => initial(c, frame, resolve))].join('');
  const timeline = animated
    .flatMap((c) => [...holds(c, frame, resolve), ...keyframeTweens(c, frame, resolve).map(tweenLine)])
    .join('');
  return { setup, timeline };
}

function tweenLine(t: KfTween): string {
  return `tl.fromTo(${js(t.target)},${js(t.from)},${js({ ...t.to, duration: t.duration, ease: t.ease, immediateRender: false })},${t.at});`;
}

function placement(props: Record<string, unknown>): Placement | null {
  const { x, y, width, height } = props as Partial<Placement>;
  return [x, y, width, height].every((n) => typeof n === 'number') ? ({ x, y, width, height } as Placement) : null;
}

export function wrapAnimated(clip: MotionClip, frame: Frame, inner: string): string {
  if (!isAnimated(clip)) {
    return inner;
  }
  const p = placement(clip.props);
  const box: Box = p ? boxOf(p, frame) : { left: 0, top: 0, width: frame.width, height: frame.height };
  const ax = clip.transform.anchorX ?? TRANSFORM.anchorX.fallback;
  const ay = clip.transform.anchorY ?? TRANSFORM.anchorY.fallback;
  const origin = `${px(box.left + ax * box.width)} ${px(box.top + ay * box.height)}`;
  const perspective = clip.keyframes.perspective?.[0]?.value ?? clip.transform.perspective ?? TRANSFORM.perspective.fallback;

  return `<div class="kp" id="kp-${clip.id}" style="${css({ perspective: px(Number(perspective)), perspectiveOrigin: origin })}"><div class="kf" id="kf-${clip.id}" style="${css({ transformOrigin: origin })}"><div class="ks" id="ks-${clip.id}" style="${css({ transformOrigin: origin })}">${inner}</div></div></div>`;
}

export function colourOverrides(clip: MotionClip): Record<string, string> {
  return Object.fromEntries(
    Object.keys(clip.keyframes)
      .filter((key) => animProp(clip.component, key)?.kind === ValueKind.Color)
      .map((key) => [key, `var(${cssVar(key)})`])
  );
}

export function sceneKeys(clip: MotionClip): Partial<Record<SceneKey, Keyframe[]>> {
  return Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => animProp(clip.component, key)?.source === Source.Scene));
}
