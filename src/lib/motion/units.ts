import type { ComponentId } from './components';
import type { CAMERA_LANE } from './camera';
import { MASK_KEYS, MASK_PROPS } from './mask';

export type Owner = ComponentId | typeof CAMERA_LANE | null;

export enum Unit {
  Px = 'px',
  Percent = '%',
  Degrees = '°',
  PxPerSecond = 'px/s',
  PxPerSecondSquared = 'px/s²'
}

enum Basis {
  Width = 'width',
  Height = 'height',
  Short = 'short',
  Hundred = 'hundred',
  Same = 'same'
}

export type Frame = { width: number; height: number };

type Reach = readonly [number, number];

type Rule = { unit: Unit; basis: Basis; reach?: Reach; transform?: true };

const ONE_FRAME: Reach = [-1, 1];
const UP_TO_FRAME: Reach = [0, 1];
const UP_TO_TWO_FRAMES: Reach = [0, 2];
const SCALE_REACH: Reach = [0, 4];
const MIRROR_SCALE_REACH: Reach = [-4, 4];
const ONE_TURN: Reach = [-360, 360];
const NEAR_DEPTH: Reach = [-2000, 2000];
const FAR_DEPTH: Reach = [-1000, 4000];

const px = (basis: Basis, reach?: Reach, transform?: true): Rule => ({
  unit: Unit.Px,
  basis,
  reach,
  transform
});
const percent = (reach?: Reach, transform?: true): Rule => ({
  unit: Unit.Percent,
  basis: Basis.Hundred,
  reach,
  transform
});
const degrees = (transform?: true): Rule => ({
  unit: Unit.Degrees,
  basis: Basis.Same,
  reach: ONE_TURN,
  transform
});

export const PROPERTY_UNITS: Readonly<Record<string, Rule>> = {
  x: px(Basis.Width, ONE_FRAME, true),
  y: px(Basis.Height, ONE_FRAME, true),
  z: px(Basis.Same, NEAR_DEPTH, true),
  depth: px(Basis.Same, FAR_DEPTH),
  focusDistance: px(Basis.Same, FAR_DEPTH),
  perspective: px(Basis.Same, undefined, true),
  blur: px(Basis.Same, undefined, true),
  scale: percent(SCALE_REACH, true),
  scaleX: percent(MIRROR_SCALE_REACH, true),
  scaleY: percent(MIRROR_SCALE_REACH, true),
  opacity: percent(undefined, true),
  rotateX: degrees(true),
  rotateY: degrees(true),
  rotateZ: degrees(true),
  skewX: degrees(true),
  skewY: degrees(true),
  maskX: px(Basis.Width, ONE_FRAME, true),
  maskY: px(Basis.Height, ONE_FRAME, true),
  maskWidth: px(Basis.Width, UP_TO_TWO_FRAMES, true),
  maskHeight: px(Basis.Height, UP_TO_TWO_FRAMES, true),
  maskRotation: degrees(true),
  maskFeather: px(Basis.Same, undefined, true),
  maskExpansion: px(Basis.Same, undefined, true),
  maskOpacity: percent(undefined, true),
  width: px(Basis.Width, UP_TO_FRAME),
  height: px(Basis.Height, UP_TO_FRAME),
  rotation: degrees(),
  size: px(Basis.Short),
  strokeWidth: px(Basis.Short),
  dash: px(Basis.Short),
  gap: px(Basis.Short),
  emitterX: px(Basis.Width),
  emitterY: px(Basis.Height),
  emitterWidth: px(Basis.Width),
  emitterHeight: px(Basis.Height),
  sizeStart: px(Basis.Short),
  sizeEnd: px(Basis.Short),
  opacityStart: percent(),
  opacityEnd: percent(),
  objectRotateX: degrees(),
  objectRotateY: degrees(),
  objectRotateZ: degrees(),
  orbit: degrees(),
  gradientAngle: degrees(),
  gravity: { unit: Unit.PxPerSecondSquared, basis: Basis.Same },
  velocityX: { unit: Unit.PxPerSecond, basis: Basis.Same },
  velocityY: { unit: Unit.PxPerSecond, basis: Basis.Same },
  ringRadius: px(Basis.Short),
  cardHeight: px(Basis.Short),
  tiltX: degrees(),
  tiltZ: degrees(),
  spin: degrees(),
  backOpacity: percent(),
  backBlur: px(Basis.Same),
  shadowOpacity: percent(),
  cameraDistance: px(Basis.Same),
  cameraHeight: px(Basis.Height, ONE_FRAME),
  restitution: percent(),
  friction: percent()
};

const FACTOR: Record<Basis, (frame: Frame) => number> = {
  [Basis.Width]: (f) => f.width,
  [Basis.Height]: (f) => f.height,
  [Basis.Short]: (f) => Math.min(f.width, f.height),
  [Basis.Hundred]: () => 100,
  [Basis.Same]: () => 1
};

const SCALED_STEP = 1;
const PRECISION = 100;

function ruleOf(component: Owner, key: string): Rule | null {
  const rule = PROPERTY_UNITS[key];
  if (!rule || component === null) {
    return null;
  }
  return component === 'Custom' && !rule.transform ? null : rule;
}

export function propsOwner(component: ComponentId): Owner {
  return component === 'Custom' ? null : component;
}

export function unitOf(component: Owner, key: string): Unit | null {
  return ruleOf(component, key)?.unit ?? null;
}

const factorOf = (component: Owner, key: string, frame: Frame) => {
  const rule = ruleOf(component, key);
  return rule ? FACTOR[rule.basis](frame) : 1;
};

const tidy = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function toShown(component: Owner, key: string, value: number, frame: Frame): number {
  const rule = ruleOf(component, key);
  return rule ? tidy(value * FACTOR[rule.basis](frame)) : value;
}

export function toStored(component: Owner, key: string, value: number, frame: Frame): number {
  return value / factorOf(component, key, frame);
}

export type Ranged = { key: string; min: number; max: number; step: number };
export type Slider = {
  unit: Unit | null;
  min: number;
  max: number;
  step: number;
};

export function sliderOf(component: Owner, prop: Ranged, frame: Frame): Slider {
  const rule = ruleOf(component, prop.key);
  if (!rule) {
    return { unit: null, min: prop.min, max: prop.max, step: prop.step };
  }
  const factor = FACTOR[rule.basis](frame);
  const [low, high] = rule.reach ?? [prop.min, prop.max];
  return {
    unit: rule.unit,
    min: tidy(Math.max(prop.min, low) * factor),
    max: tidy(Math.min(prop.max, high) * factor),
    step: factor === 1 ? prop.step : SCALED_STEP
  };
}

export function shownRecord(component: Owner, values: Record<string, unknown>, frame: Frame): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).map(([key, v]) => [key, typeof v === 'number' ? toShown(component, key, v, frame) : v]));
}

export function storedRecord<T extends Record<string, unknown>>(component: Owner, values: T, frame: Frame): T {
  return Object.fromEntries(Object.entries(values).map(([key, v]) => [key, typeof v === 'number' ? toStored(component, key, v, frame) : v])) as T;
}

type Valued = { value: number | string };

export function shownKeyframes<K extends Valued>(component: Owner, keyframes: Record<string, K[] | undefined>, frame: Frame): Record<string, K[]> {
  return Object.fromEntries(
    Object.entries(keyframes).map(([key, track]) => [key, (track ?? []).map((k) => (typeof k.value === 'number' ? { ...k, value: toShown(component, key, k.value, frame) } : k))])
  );
}

const MASK_FIELDS = MASK_KEYS.map((key) => [MASK_PROPS[key].field, key] as const);

function convertMask<T extends Record<string, unknown>>(mask: T, convert: (key: string, value: number) => number): T {
  const out: Record<string, unknown> = { ...mask };
  for (const [field, key] of MASK_FIELDS) {
    if (typeof out[field] === 'number') {
      out[field] = convert(key, out[field] as number);
    }
  }
  return out as T;
}

export function shownMask<T extends Record<string, unknown>>(component: Owner, mask: T, frame: Frame): T {
  return convertMask(mask, (key, v) => toShown(component, key, v, frame));
}

export function storedMask<T extends Record<string, unknown>>(component: Owner, mask: T, frame: Frame): T {
  return convertMask(mask, (key, v) => toStored(component, key, v, frame));
}

export type Offset = [number, number];

export function shownOffset(component: Owner, [dx, dy]: Offset, frame: Frame): Offset {
  return [toShown(component, 'x', dx, frame), toShown(component, 'y', dy, frame)];
}

export function storedOffset(component: Owner, [dx, dy]: Offset, frame: Frame): Offset {
  return [toStored(component, 'x', dx, frame), toStored(component, 'y', dy, frame)];
}

export const UNITS_GUIDE =
  'Units: x, y, width, height (of clips, masks and particle emitters) in px of the composition; size, strokeWidth, dash, gap and particle sizes in px; z, perspective, blur, feather and expansion in px; scale, scaleX, scaleY and opacity in % (100 = as is); rotations, skews and angles in degrees.';
