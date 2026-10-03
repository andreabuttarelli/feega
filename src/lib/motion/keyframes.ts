import { z } from 'zod';
import { COLOR, type ComponentId } from './components';
import { EASE_IDS, Ease } from './design';

export type Bezier = [number, number, number, number];
export type EaseSpec = Ease | Bezier;
export type KeyValue = number | string;
export type Keyframe = { frame: number; value: KeyValue; ease: EaseSpec };
export type Keyframes = Record<string, Keyframe[]>;

const unit = z.number().min(0).max(1);
const ordinate = z.number().min(-2).max(3);

export const easeSchema = z.union([z.enum(EASE_IDS), z.tuple([unit, ordinate, unit, ordinate])]);

export const keyframeSchema = z.object({
  frame: z.number().int().min(0),
  value: z.union([z.number(), z.string()]),
  ease: easeSchema.default(Ease.Standard)
});

export enum ValueKind {
  Number = 'number',
  Color = 'color'
}

export enum Source {
  Transform = 'transform',
  Prop = 'prop',
  Scene = 'scene'
}

type Range = { label: string; min: number; max: number; step: number; fallback: number };

export const TRANSFORM = {
  x: { label: 'Offset X', min: -2, max: 2, step: 0.01, fallback: 0 },
  y: { label: 'Offset Y', min: -2, max: 2, step: 0.01, fallback: 0 },
  z: { label: 'Depth Z', min: -4000, max: 2000, step: 1, fallback: 0 },
  scale: { label: 'Scale', min: 0, max: 10, step: 0.01, fallback: 1 },
  scaleX: { label: 'Scale X', min: -10, max: 10, step: 0.01, fallback: 1 },
  scaleY: { label: 'Scale Y', min: -10, max: 10, step: 0.01, fallback: 1 },
  rotateX: { label: 'Rotate X', min: -1080, max: 1080, step: 1, fallback: 0 },
  rotateY: { label: 'Rotate Y', min: -1080, max: 1080, step: 1, fallback: 0 },
  rotateZ: { label: 'Rotate Z', min: -1080, max: 1080, step: 1, fallback: 0 },
  skewX: { label: 'Skew X', min: -80, max: 80, step: 1, fallback: 0 },
  skewY: { label: 'Skew Y', min: -80, max: 80, step: 1, fallback: 0 },
  perspective: { label: 'Perspective', min: 100, max: 10000, step: 10, fallback: 1200 },
  anchorX: { label: 'Anchor X', min: 0, max: 1, step: 0.01, fallback: 0.5 },
  anchorY: { label: 'Anchor Y', min: 0, max: 1, step: 0.01, fallback: 0.5 },
  opacity: { label: 'Opacity', min: 0, max: 1, step: 0.01, fallback: 1 },
  blur: { label: 'Blur', min: 0, max: 100, step: 0.5, fallback: 0 }
} as const satisfies Record<string, Range>;

export type TransformKey = keyof typeof TRANSFORM;
export const TRANSFORM_KEYS = Object.keys(TRANSFORM) as TransformKey[];
export type Transform = Partial<Record<TransformKey, number>>;

export const transformSchema = z.object(Object.fromEntries(TRANSFORM_KEYS.map((k) => [k, z.number().min(TRANSFORM[k].min).max(TRANSFORM[k].max).optional()]))) as z.ZodType<Transform>;

export const SCENE = {
  objectRotateX: { label: 'Object X', min: -1080, max: 1080, step: 1, fallback: 0 },
  objectRotateY: { label: 'Object Y', min: -1080, max: 1080, step: 1, fallback: 0 },
  objectRotateZ: { label: 'Object Z', min: -1080, max: 1080, step: 1, fallback: 0 },
  orbit: { label: 'Camera orbit', min: -1080, max: 1080, step: 1, fallback: 0 },
  dolly: { label: 'Camera dolly', min: 0.3, max: 3, step: 0.01, fallback: 1 },
  fov: { label: 'Camera FOV', min: 10, max: 120, step: 1, fallback: 35 }
} as const satisfies Record<string, Range>;

export type SceneKey = keyof typeof SCENE;
export const SCENE_KEYS = Object.keys(SCENE) as SceneKey[];

export type AnimProp = { key: string; label: string; kind: ValueKind; source: Source; min: number; max: number; step: number; fallback: number };

const ANCHORS: readonly TransformKey[] = ['anchorX', 'anchorY'];

const transformProps: AnimProp[] = TRANSFORM_KEYS.filter((k) => !ANCHORS.includes(k)).map((key) => ({ key, kind: ValueKind.Number, source: Source.Transform, ...TRANSFORM[key] }));
const sceneProps: AnimProp[] = SCENE_KEYS.map((key) => ({ key, kind: ValueKind.Number, source: Source.Scene, ...SCENE[key] }));
const colours = (...entries: [string, string][]): AnimProp[] =>
  entries.map(([key, label]) => ({ key, label, kind: ValueKind.Color, source: Source.Prop, min: 0, max: 0, step: 0, fallback: 0 }));

export const ANIMATABLE: Record<ComponentId, readonly AnimProp[]> = {
  Title: [...transformProps, ...colours(['color', 'Colour'])],
  Text: [...transformProps, ...colours(['color', 'Colour'])],
  Kicker: [...transformProps, ...colours(['color', 'Colour'])],
  Caption: [...transformProps, ...colours(['color', 'Colour'], ['background', 'Box'])],
  Image: transformProps,
  Video: transformProps,
  Audio: [],
  Shape: [...transformProps, ...colours(['fill', 'Fill'])],
  Logo: transformProps,
  BrandBackground: [...transformProps, ...colours(['fill', 'Fill'])],
  ProductCard: [...transformProps, ...colours(['color', 'Colour'], ['card', 'Card'])],
  SocialMockup: transformProps,
  CanvasMock: transformProps,
  Model3D: [...transformProps, ...sceneProps],
  Shape3D: [...transformProps, ...sceneProps]
};

export function animProp(component: ComponentId, key: string): AnimProp | null {
  return ANIMATABLE[component].find((p) => p.key === key) ?? null;
}

export type Animated = { component: ComponentId; props: Record<string, unknown>; transform: Transform; keyframes: Keyframes };

const SCENE_FROM_PROPS: Partial<Record<SceneKey, string>> = { orbit: 'startAngle', dolly: 'zoom' };

const BASE: Record<Source, (clip: Animated, prop: AnimProp) => KeyValue> = {
  [Source.Transform]: (clip, prop) => clip.transform[prop.key as TransformKey] ?? prop.fallback,
  [Source.Prop]: (clip, prop) => String(clip.props[prop.key]),
  [Source.Scene]: (clip, prop) => {
    const from = SCENE_FROM_PROPS[prop.key as SceneKey];
    return from ? Number(clip.props[from]) : prop.fallback;
  }
};

export function baseValue(clip: Animated, key: string): KeyValue | null {
  const prop = animProp(clip.component, key);
  return prop ? BASE[prop.source](clip, prop) : null;
}

export function isAnimatable(component: ComponentId, key: string): boolean {
  return animProp(component, key) !== null;
}

function valueProblem(prop: AnimProp, value: KeyValue): string | null {
  if (prop.kind === ValueKind.Color) {
    return typeof value === 'string' && COLOR.test(value) ? null : `${prop.key}: a colour keyframe takes #rrggbb or a brand colour`;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${prop.key}: expected a number`;
  }
  return value < prop.min || value > prop.max ? `${prop.key}: ${value} is outside ${prop.min}..${prop.max}` : null;
}

export function keyframesProblem(component: ComponentId, keyframes: Keyframes): string | null {
  for (const [key, track] of Object.entries(keyframes)) {
    const prop = animProp(component, key);
    if (!prop) {
      const allowed = ANIMATABLE[component].map((p) => p.key).join(', ') || 'nothing';
      return `${component} cannot animate ${key}; it animates: ${allowed}`;
    }
    for (const k of track) {
      const problem = valueProblem(prop, k.value);
      if (problem) {
        return problem;
      }
    }
  }
  return null;
}

export const GSAP_EASE: Record<Ease, string> = {
  [Ease.Standard]: 'power3.out',
  [Ease.Enter]: 'power2.out',
  [Ease.Exit]: 'power2.in',
  [Ease.Linear]: 'none',
  [Ease.Overshoot]: 'back.out(1.7)'
};

export function easeName(ease: EaseSpec): string {
  return typeof ease === 'string' ? GSAP_EASE[ease] : `kf-bz-${ease.map((n) => String(n).replace('.', '_').replace('-', 'm')).join('-')}`;
}

export function sampleTrack(track: { frame: number; value: number | string; ease: string | number[] }[], frame: number): number {
  const curves: Record<string, (p: number) => number> = {
    standard: (p) => 1 - (1 - p) ** 4,
    enter: (p) => 1 - (1 - p) ** 3,
    exit: (p) => p ** 3,
    linear: (p) => p,
    overshoot: (p) => {
      const q = p - 1;
      return p ? q * q * (2.7 * q + 1.7) + 1 : 0;
    }
  };
  const bezier = (b: number[], p: number) => {
    if (p <= 0 || p >= 1) {
      return p <= 0 ? 0 : 1;
    }
    const cx = 3 * b[0];
    const bx = 3 * (b[2] - b[0]) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * b[1];
    const by = 3 * (b[3] - b[1]) - cy;
    const ay = 1 - cy - by;
    const xAt = (t: number) => ((ax * t + bx) * t + cx) * t;
    let lo = 0;
    let hi = 1;
    let t = p;
    for (let i = 0; i < 48; i++) {
      if (xAt(t) < p) {
        lo = t;
      } else {
        hi = t;
      }
      t = (lo + hi) / 2;
    }
    return ((ay * t + by) * t + cy) * t;
  };

  const first = track[0];
  const last = track[track.length - 1];
  if (frame <= first.frame) {
    return Number(first.value);
  }
  if (frame >= last.frame) {
    return Number(last.value);
  }

  let i = 0;
  while (track[i + 1].frame <= frame) {
    i++;
  }
  const a = track[i];
  const b = track[i + 1];
  const p = (frame - a.frame) / (b.frame - a.frame);
  const eased = typeof a.ease === 'string' ? curves[a.ease](p) : bezier(a.ease, p);
  return Number(a.value) + (Number(b.value) - Number(a.value)) * eased;
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channels(hex: string): number[] {
  const m = HEX.exec(hex);
  return m ? m.slice(1).map((c) => parseInt(c, 16)) : [0, 0, 0];
}

export function mixColor(from: string, to: string, p: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * p).toString(16).padStart(2, '0')).join('')}`;
}

export function sampleColor(track: Keyframe[], frame: number, resolve: (v: string) => string): string {
  const resolved = track.map((k, i) => ({ ...k, value: i }));
  const position = sampleTrack(resolved, frame);
  const lower = Math.min(Math.floor(position), track.length - 1);
  const upper = Math.min(lower + 1, track.length - 1);
  return mixColor(resolve(String(track[lower].value)), resolve(String(track[upper].value)), position - lower);
}
