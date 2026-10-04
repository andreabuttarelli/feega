import type { MotionClip } from '../doc';
import { Source, TRANSFORM, animProp, easeName, isPlainTrack, sampleColor, sampleTrack, type EaseSpec, type Keyframe, type SceneKey, type TransformKey } from '../keyframes';
import { css, js, px } from './html';
import { Ease } from '../design';
import { MASK_LANES, MaskScope, maskTarget } from './masks';
import type { MaskKey } from '../mask';
import { ParentOpacity, pivotOf } from '../parent';
import { animatorOfKey, animatorProps, cssName } from '../text-animators/model';
import { textHostId } from '../text-animators/render';
import { ENGINE_GLOBAL } from '../engine/engine';

export const ENGINE = `window.${ENGINE_GLOBAL}`;

type Frame = { width: number; height: number; fps: number };

enum Wrapper {
  Perspective = 'kp',
  Transform = 'kf',
  Scale = 'ks'
}

type Channel = { wrapper: Wrapper; prop: string; out: (value: number, frame: Frame) => number | string };

const same = (v: number) => v;

const CHANNELS: Record<Exclude<TransformKey, 'anchorX' | 'anchorY'>, Channel> = {
  x: { wrapper: Wrapper.Transform, prop: 'x', out: (v, f) => round(v * f.width) },
  y: { wrapper: Wrapper.Transform, prop: 'y', out: (v, f) => round(v * f.height) },
  z: { wrapper: Wrapper.Transform, prop: 'z', out: same },
  scale: { wrapper: Wrapper.Scale, prop: 'scale', out: same },
  scaleX: { wrapper: Wrapper.Transform, prop: 'scaleX', out: same },
  scaleY: { wrapper: Wrapper.Transform, prop: 'scaleY', out: same },
  rotateX: { wrapper: Wrapper.Transform, prop: 'rotationX', out: same },
  rotateY: { wrapper: Wrapper.Transform, prop: 'rotationY', out: same },
  rotateZ: { wrapper: Wrapper.Transform, prop: 'rotation', out: same },
  skewX: { wrapper: Wrapper.Transform, prop: 'skewX', out: same },
  skewY: { wrapper: Wrapper.Transform, prop: 'skewY', out: same },
  perspective: { wrapper: Wrapper.Perspective, prop: 'perspective', out: (v) => px(v) },
  opacity: { wrapper: Wrapper.Transform, prop: 'opacity', out: same },
  blur: { wrapper: Wrapper.Transform, prop: 'filter', out: (v) => `blur(${px(v)})` }
};

export const ANIMATE_CSS = '.kp{position:absolute;inset:0}.kf,.ks{position:absolute;inset:0;transform-style:preserve-3d;backface-visibility:visible;will-change:transform,opacity,filter}';

type TweenVars = Record<string, unknown>;

export type KfTween = { target: string; from: TweenVars; to: TweenVars; at: number; duration: number; ease: string };

type Lane = { target: string; source: Source; track: Keyframe[]; vars: (value: Keyframe['value']) => TweenVars };

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const COPY_CLASS: Record<Wrapper, (key: string) => string> = {
  [Wrapper.Perspective]: () => 'kpc',
  [Wrapper.Transform]: (key) => (key === 'opacity' ? 'ko' : 'kc'),
  [Wrapper.Scale]: () => 'ksc'
};

export type Parents = ReadonlySet<string>;

const target = (wrapper: Wrapper, clip: MotionClip, key = '', parents: Parents = new Set()) => `#${wrapper}-${clip.id}${parents.has(clip.id) ? `,.${COPY_CLASS[wrapper](key)}-${clip.id}` : ''}`;

const CSS_VAR_PREFIX = '--kc-';

export function cssVar(key: string): string {
  return `${CSS_VAR_PREFIX}${key}`;
}

export function isAnimated(clip: MotionClip): boolean {
  return Object.keys(clip.transform).length > 0 || Object.keys(clip.keyframes).length > 0;
}

type LaneInput = { clip: MotionClip; key: string; track: Keyframe[]; frame: Frame; resolve: (color: string) => string; parents: Parents };

const LANE: Record<Source, (input: LaneInput) => Lane[]> = {
  [Source.Transform]: ({ clip, key, track, frame, parents }) => {
    const channel = CHANNELS[key as keyof typeof CHANNELS];
    return [{ target: target(channel.wrapper, clip, key, parents), source: Source.Transform, track, vars: (v) => ({ [channel.prop]: channel.out(Number(v), frame) }) }];
  },
  [Source.Prop]: ({ clip, key, track, resolve }) => [{ target: target(Wrapper.Scale, clip), source: Source.Prop, track, vars: (v) => ({ [cssVar(key)]: resolve(String(v)) }) }],
  [Source.Scene]: () => [],
  [Source.Param]: () => [],
  [Source.Effect]: () => [],
  [Source.Modifier]: () => [],
  [Source.Animator]: ({ clip, key, track, resolve }) => {
    const ref = animatorOfKey(key);
    return ref ? [{ target: `#${textHostId(clip.id)}`, source: Source.Animator, track, vars: (v) => ({ [cssName(ref.id, ref.field)]: typeof v === 'string' ? resolve(v) : v }) }] : [];
  },
  [Source.Mask]: ({ clip, key, track, frame }) =>
    clip.mask
      ? MASK_LANES[key as MaskKey].map((a) => ({ target: `#${maskTarget(MaskScope.Own, a.part, clip.id)}`, source: Source.Mask, track, vars: (v) => ({ attr: { [a.attr]: a.out(Number(v), frame) } }) }))
      : []
};

function lanes(clip: MotionClip, frame: Frame, resolve: (color: string) => string, parents: Parents): Lane[] {
  return Object.entries(clip.keyframes).flatMap(([key, track]) => {
    const prop = animProp(clip.component, key, animatorProps(clip.animators));
    return prop ? LANE[prop.source]({ clip, key, track, frame, resolve, parents }) : [];
  });
}

function frameByFrame(track: Keyframe[], resolve: (color: string) => string): Keyframe[] {
  const first = track[0].frame;
  const last = track[track.length - 1].frame;
  const colour = typeof track[0].value === 'string';
  return Array.from({ length: last - first + 1 }, (_, i) => ({
    frame: first + i,
    value: colour ? sampleColor(track, first + i, resolve) : sampleTrack(track, first + i),
    ease: Ease.Linear
  }));
}

function bakedLane(lane: Lane, resolve: (color: string) => string): Lane {
  return isPlainTrack(lane.track) ? lane : { ...lane, track: frameByFrame(lane.track, resolve) };
}

export function keyframeTweens(clip: MotionClip, frame: Frame, resolve: (color: string) => string, parents: Parents = new Set()): KfTween[] {
  return lanes(clip, frame, resolve, parents).map((lane) => bakedLane(lane, resolve)).flatMap((lane) =>
    lane.track.slice(0, -1).map((k, i) => {
      const next = lane.track[i + 1];
      return {
        target: lane.target,
        from: lane.vars(k.value),
        to: lane.vars(next.value),
        at: (clip.from + k.frame) / frame.fps,
        duration: (next.frame - k.frame) / frame.fps,
        ease: easeName(k.ease)
      };
    })
  );
}

function holds(clip: MotionClip, frame: Frame, resolve: (color: string) => string, parents: Parents): string[] {
  const start = clip.from / frame.fps;
  return lanes(clip, frame, resolve, parents).map((lane) => `tl.set(${js(lane.target)},${js(lane.vars(lane.track[0].value))},${start});`);
}

function initial(clip: MotionClip, frame: Frame, resolve: (color: string) => string, parents: Parents): string[] {
  const vars = new Map<string, TweenVars>();
  const put = (t: string, prop: string, value: number | string) => vars.set(t, { ...vars.get(t), [prop]: value });

  for (const [key, channel] of Object.entries(CHANNELS) as [keyof typeof CHANNELS, Channel][]) {
    const track = clip.keyframes[key];
    const value = track?.length ? Number(track[0].value) : clip.transform[key];
    if (value === undefined || channel.wrapper === Wrapper.Perspective) {
      continue;
    }
    put(target(channel.wrapper, clip, key, parents), channel.prop, channel.out(value, frame));
  }
  for (const lane of lanes(clip, frame, resolve, parents).filter((l) => l.source === Source.Prop)) {
    vars.set(lane.target, { ...vars.get(lane.target), ...lane.vars(lane.track[0].value) });
  }
  return [...vars].map(([t, v]) => `${ENGINE}.set(${js(t)},${js(v)});`);
}

function bezierEases(clips: MotionClip[]): string[] {
  const curves = new Map<string, EaseSpec>();
  for (const k of clips.flatMap((c) => Object.values(c.keyframes).flat())) {
    if (typeof k.ease !== 'string') {
      curves.set(easeName(k.ease), k.ease);
    }
  }
  return [...curves].map(([name, ease]) => `${ENGINE}.registerEase(${js(name)},function(p){return KF_SAMPLE([{frame:0,value:0,ease:${js(ease)}},{frame:1,value:1,ease:"linear"}],p);});`);
}

export function animationScript(clips: MotionClip[], frame: Frame, resolve: (color: string) => string, parents: Parents = new Set()): { setup: string; timeline: string } {
  const animated = clips.filter(isAnimated);
  const eases = bezierEases(animated);
  const sampler = eases.length ? `const KF_SAMPLE=(${sampleTrack.toString()});` : '';
  const setup = [sampler, ...eases, ...animated.flatMap((c) => initial(c, frame, resolve, parents))].join('');
  const timeline = animated
    .flatMap((c) => [...holds(c, frame, resolve, parents), ...keyframeTweens(c, frame, resolve, parents).map(tweenLine)])
    .join('');
  return { setup, timeline };
}

function tweenLine(t: KfTween): string {
  return `tl.fromTo(${js(t.target)},${js(t.from)},${js({ ...t.to, duration: t.duration, ease: t.ease, immediateRender: false })},${t.at});`;
}

type WrapperNames = Record<Wrapper, string>;

function wrapped(clip: MotionClip, frame: Frame, names: WrapperNames, inner: string): string {
  const [x, y] = pivotOf(clip, frame);
  const origin = `${px(x)} ${px(y)}`;
  const perspective = clip.keyframes.perspective?.[0]?.value ?? clip.transform.perspective ?? TRANSFORM.perspective.fallback;

  return `<div ${names[Wrapper.Perspective]} style="${css({ perspective: px(Number(perspective)), perspectiveOrigin: origin })}"><div ${names[Wrapper.Transform]} style="${css({ transformOrigin: origin })}"><div ${names[Wrapper.Scale]} style="${css({ transformOrigin: origin })}">${inner}</div></div></div>`;
}

export function wrapAnimated(clip: MotionClip, frame: Frame, inner: string): string {
  if (!isAnimated(clip)) {
    return inner;
  }
  return wrapped(clip, frame, { [Wrapper.Perspective]: `class="kp" id="kp-${clip.id}"`, [Wrapper.Transform]: `class="kf" id="kf-${clip.id}"`, [Wrapper.Scale]: `class="ks" id="ks-${clip.id}"` }, inner);
}

const OPACITY_CLASS: Record<ParentOpacity, (id: string) => string> = {
  [ParentOpacity.Inherit]: (id) => ` ${COPY_CLASS[Wrapper.Transform]('opacity')}-${id}`,
  [ParentOpacity.Ignore]: () => ''
};

export function wrapParents(chain: readonly MotionClip[], child: MotionClip, frame: Frame, inner: string): string {
  return chain
    .filter(isAnimated)
    .reduceRight(
      (acc, parent) =>
        wrapped(
          parent,
          frame,
          {
            [Wrapper.Perspective]: `class="kp ${COPY_CLASS[Wrapper.Perspective]('')}-${parent.id}"`,
            [Wrapper.Transform]: `class="kf ${COPY_CLASS[Wrapper.Transform]('')}-${parent.id}${OPACITY_CLASS[child.parentOpacity](parent.id)}"`,
            [Wrapper.Scale]: `class="ks ${COPY_CLASS[Wrapper.Scale]('')}-${parent.id}"`
          },
          acc
        ),
      inner
    );
}

export function keyedOverrides(clip: MotionClip): Record<string, string> {
  return Object.fromEntries(
    Object.keys(clip.keyframes)
      .filter((key) => animProp(clip.component, key)?.source === Source.Prop)
      .map((key) => [key, `var(${cssVar(key)})`])
  );
}

export function sceneKeys(clip: MotionClip): Partial<Record<SceneKey, Keyframe[]>> {
  return Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => animProp(clip.component, key)?.source === Source.Scene));
}
