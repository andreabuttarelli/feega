import { z } from 'zod';
import { COLOR, TYPE, type ComponentId } from './components';
import { EASE_IDS, Ease } from './design';
import { MASK_KEYS, MASK_PROPS, maskValue, type Mask, type MaskKey } from './mask';

export type Bezier = [number, number, number, number];
export type EaseSpec = Ease | Bezier;
export type KeyValue = number | string;
export enum Interp {
  Bezier = 'bezier',
  Linear = 'linear',
  Hold = 'hold',
  Auto = 'auto',
  Continuous = 'continuous'
}

export const INTERPS = Object.values(Interp) as [Interp, ...Interp[]];

export const INTERP_LABEL: Record<Interp, string> = {
  [Interp.Bezier]: 'Bezier',
  [Interp.Linear]: 'Linear',
  [Interp.Hold]: 'Hold',
  [Interp.Auto]: 'Auto-bezier',
  [Interp.Continuous]: 'Continuous'
};

export type Keyframe = { frame: number; value: KeyValue; ease: EaseSpec; in?: Interp; out?: Interp; roving?: boolean };
export type Keyframes = Record<string, Keyframe[]>;

const unit = z.number().min(0).max(1);
const ordinate = z.number().min(-2).max(3);

export const easeSchema = z.union([z.enum(EASE_IDS), z.tuple([unit, ordinate, unit, ordinate])]);

export const keyframeSchema = z.object({
  frame: z.number().int().min(0),
  value: z.union([z.number(), z.string()]),
  ease: easeSchema.default(Ease.Standard),
  in: z.enum(INTERPS).optional(),
  out: z.enum(INTERPS).optional(),
  roving: z.boolean().optional()
});

export const SPATIAL_KEYS: readonly string[] = ['x', 'y', 'z'];

const COLOUR_INTERPS: readonly Interp[] = [Interp.Bezier, Interp.Linear, Interp.Hold];

export function isPlainTrack(track: readonly Keyframe[]): boolean {
  return track.every((k) => !k.roving && (k.in ?? Interp.Bezier) === Interp.Bezier && (k.out ?? Interp.Bezier) === Interp.Bezier);
}

export enum ValueKind {
  Number = 'number',
  Color = 'color'
}

export enum Source {
  Transform = 'transform',
  Prop = 'prop',
  Scene = 'scene',
  Mask = 'mask',
  Param = 'param',
  Effect = 'effect',
  Animator = 'animator'
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

export type AnimProp = { key: string; label: string; kind: ValueKind; source: Source; min: number; max: number; step: number; fallback: number; base?: KeyValue };

const ANCHORS: readonly TransformKey[] = ['anchorX', 'anchorY'];

const transformProps: AnimProp[] = TRANSFORM_KEYS.filter((k) => !ANCHORS.includes(k)).map((key) => ({ key, kind: ValueKind.Number, source: Source.Transform, ...TRANSFORM[key] }));
const sceneProps: AnimProp[] = SCENE_KEYS.map((key) => ({ key, kind: ValueKind.Number, source: Source.Scene, ...SCENE[key] }));
const maskProps: AnimProp[] = MASK_KEYS.map((key) => {
  const { label, min, max, step, fallback } = MASK_PROPS[key];
  return { key, label, min, max, step, fallback, kind: ValueKind.Number, source: Source.Mask };
});
const colours = (...entries: [string, string][]): AnimProp[] =>
  entries.map(([key, label]) => ({ key, label, kind: ValueKind.Color, source: Source.Prop, min: 0, max: 0, step: 0, fallback: 0 }));

const visual = (...extra: AnimProp[][]): AnimProp[] => [...transformProps, ...extra.flat(), ...maskProps];

const typeNumbers: AnimProp[] = (
  [
    ['weight', 'Weight', 400],
    ['tracking', 'Tracking', 0],
    ['leading', 'Leading', 1.2],
    ['stretch', 'Width axis', TYPE.stretch.fallback],
    ['slant', 'Slant axis', TYPE.slant.fallback]
  ] as const
).map(([key, label, fallback]) => ({ key, label, kind: ValueKind.Number, source: Source.Prop, min: TYPE[key].min, max: TYPE[key].max, step: TYPE[key].step, fallback }));

export const ANIMATABLE: Record<ComponentId, readonly AnimProp[]> = {
  Title: visual(colours(['color', 'Colour']), typeNumbers),
  Text: visual(colours(['color', 'Colour']), typeNumbers),
  Kicker: visual(colours(['color', 'Colour']), typeNumbers),
  Caption: visual(colours(['color', 'Colour'], ['background', 'Box']), typeNumbers),
  Image: visual(),
  Video: visual(),
  Audio: [],
  Shape: visual(colours(['fill', 'Fill'])),
  Logo: visual(),
  Null: transformProps,
  BrandBackground: visual(colours(['fill', 'Fill'])),
  ProductCard: visual(colours(['color', 'Colour'], ['card', 'Card'])),
  SocialMockup: visual(),
  CanvasMock: visual(),
  Model3D: visual(sceneProps),
  Shape3D: visual(sceneProps),
  Text3D: visual(sceneProps),
  Logo3D: visual(sceneProps),
  Composition: visual(),
  Custom: visual()
};

export function animProp(component: ComponentId, key: string, params: readonly AnimProp[] = []): AnimProp | null {
  return ANIMATABLE[component].find((p) => p.key === key) ?? params.find((p) => p.key === key) ?? null;
}

export type Animated = { component: ComponentId; props: Record<string, unknown>; transform: Transform; keyframes: Keyframes; mask: Mask | null; params?: readonly AnimProp[] };

const SCENE_FROM_PROPS: Partial<Record<SceneKey, string>> = { orbit: 'startAngle', dolly: 'zoom' };

const BASE: Record<Source, (clip: Animated, prop: AnimProp) => KeyValue> = {
  [Source.Transform]: (clip, prop) => clip.transform[prop.key as TransformKey] ?? prop.fallback,
  [Source.Prop]: (clip, prop) => (prop.kind === ValueKind.Color ? String(clip.props[prop.key]) : Number(clip.props[prop.key] ?? prop.fallback)),
  [Source.Scene]: (clip, prop) => {
    const from = SCENE_FROM_PROPS[prop.key as SceneKey];
    return from ? Number(clip.props[from]) : prop.fallback;
  },
  [Source.Mask]: (clip, prop) => (clip.mask ? maskValue(clip.mask, prop.key as MaskKey) : prop.fallback),
  [Source.Param]: (clip, prop) => (prop.kind === ValueKind.Color ? String(clip.props[prop.key]) : Number(clip.props[prop.key])),
  [Source.Effect]: (_clip, prop) => prop.base ?? prop.fallback,
  [Source.Animator]: (_clip, prop) => prop.base ?? prop.fallback
};

export function baseValue(clip: Animated, key: string): KeyValue | null {
  const prop = animProp(clip.component, key, clip.params);
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

const SOURCE_PROBLEM: Record<Source, (clip: Pick<Animated, 'mask'>, key: string) => string | null> = {
  [Source.Transform]: () => null,
  [Source.Prop]: () => null,
  [Source.Scene]: () => null,
  [Source.Mask]: (clip, key) => (clip.mask ? null : `${key}: the clip has no mask, add one first (set_mask)`),
  [Source.Param]: () => null,
  [Source.Effect]: () => null,
  [Source.Animator]: () => null
};

export function keyframesProblem(clip: Pick<Animated, 'component' | 'keyframes' | 'mask' | 'params'>): string | null {
  const { component } = clip;
  for (const [key, track] of Object.entries(clip.keyframes)) {
    const prop = animProp(component, key, clip.params);
    if (!prop) {
      const allowed = [...ANIMATABLE[component], ...(clip.params ?? [])].map((p) => p.key).join(', ') || 'nothing';
      return `${component} cannot animate ${key}; it animates: ${allowed}`;
    }
    const missing = SOURCE_PROBLEM[prop.source](clip, key);
    if (missing) {
      return missing;
    }
    const shapeProblem = interpProblem(prop, track);
    if (shapeProblem) {
      return shapeProblem;
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

function interpProblem(prop: AnimProp, track: readonly Keyframe[]): string | null {
  if (track.some((k) => k.roving) && !SPATIAL_KEYS.includes(prop.key)) {
    return `${prop.key}: roving keyframes are only for position (${SPATIAL_KEYS.join(', ')})`;
  }
  const smooth = track.some((k) => ![k.in, k.out].every((i) => !i || COLOUR_INTERPS.includes(i)));
  return prop.kind === ValueKind.Color && smooth ? `${prop.key}: a colour keyframe takes ${COLOUR_INTERPS.join(', ')} interpolation` : null;
}

export const EASE_BEZIER: Record<Ease, Bezier> = {
  [Ease.Standard]: [0.165, 0.84, 0.44, 1],
  [Ease.Enter]: [0.215, 0.61, 0.355, 1],
  [Ease.Exit]: [0.55, 0.055, 0.675, 0.19],
  [Ease.Linear]: [1 / 3, 1 / 3, 2 / 3, 2 / 3],
  [Ease.Overshoot]: [0.175, 0.885, 0.32, 1.275]
};

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

export type SampledKey = { frame: number; value: number | string; ease: string | number[]; in?: string; out?: string; roving?: boolean };

export function sampleTrack(track: SampledKey[], frame: number): number {
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
  const handles: Record<string, number[]> = {
    standard: [0.165, 0.84, 0.44, 1],
    enter: [0.215, 0.61, 0.355, 1],
    exit: [0.55, 0.055, 0.675, 0.19],
    linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3],
    overshoot: [0.175, 0.885, 0.32, 1.275]
  };
  const cubic = (a: number, b: number, c: number, d: number, t: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const along = (x1: number, x2: number, p: number) => {
    let lo = 0;
    let hi = 1;
    let t = p;
    for (let i = 0; i < 48; i++) {
      if (cubic(0, x1, x2, 1, t) < p) {
        lo = t;
      } else {
        hi = t;
      }
      t = (lo + hi) / 2;
    }
    return t;
  };
  const bezier = (b: number[], p: number) => {
    if (p <= 0 || p >= 1) {
      return p <= 0 ? 0 : 1;
    }
    return cubic(0, b[1], b[3], 1, along(b[0], b[2], p));
  };

  const keys = track.map((k) => ({ ...k, frame: k.frame }));
  let fixed = 0;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].roving && i < keys.length - 1) {
      continue;
    }
    let total = 0;
    const walked = [0];
    for (let j = fixed + 1; j <= i; j++) {
      total += Math.abs(Number(keys[j].value) - Number(keys[j - 1].value));
      walked.push(total);
    }
    for (let j = fixed + 1; j < i && total > 0; j++) {
      keys[j].frame = keys[fixed].frame + ((keys[i].frame - keys[fixed].frame) * walked[j - fixed]) / total;
    }
    fixed = i;
  }

  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) {
    return Number(first.value);
  }
  if (frame >= last.frame) {
    return Number(last.value);
  }

  let i = 0;
  while (keys[i + 1].frame <= frame) {
    i++;
  }
  const a = keys[i];
  const b = keys[i + 1];
  const va = Number(a.value);
  const vb = Number(b.value);
  const dt = b.frame - a.frame;
  const dv = vb - va;
  const p = (frame - a.frame) / dt;
  const out = a.out ?? 'bezier';
  const into = b.in ?? 'bezier';

  if (out === 'hold' || into === 'hold') {
    return va;
  }
  if (out === 'bezier' && into === 'bezier') {
    const eased = typeof a.ease === 'string' ? curves[a.ease](p) : bezier(a.ease, p);
    return va + dv * eased;
  }

  const through = (k: number, clamp: boolean) => {
    if (k === 0 || k === keys.length - 1) {
      return 0;
    }
    const before = Number(keys[k].value) - Number(keys[k - 1].value);
    const after = Number(keys[k + 1].value) - Number(keys[k].value);
    if (clamp && before * after <= 0) {
      return 0;
    }
    return (Number(keys[k + 1].value) - Number(keys[k - 1].value)) / (keys[k + 1].frame - keys[k - 1].frame);
  };
  const slopeOf: Record<string, (k: number) => number> = {
    linear: () => dv / dt,
    auto: (k) => through(k, true),
    continuous: (k) => through(k, false)
  };
  const ease = typeof a.ease === 'string' ? handles[a.ease] : a.ease;
  const x1 = out === 'bezier' ? ease[0] : 1 / 3;
  const y1 = out === 'bezier' ? va + ease[1] * dv : va + (slopeOf[out](i) * dt) / 3;
  const x2 = into === 'bezier' ? ease[2] : 2 / 3;
  const y2 = into === 'bezier' ? va + ease[3] * dv : vb - (slopeOf[into](i + 1) * dt) / 3;
  return cubic(va, y1, y2, vb, along(x1, x2, p));
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
