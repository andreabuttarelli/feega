import type { MotionDoc } from '../doc';
import { easeCurve } from '../sample-track';
import { layersOf, type Layer } from './layer';

export enum LayerRole {
  Matched = 'matched',
  Entering = 'entering',
  Leaving = 'leaving'
}

export type AnimatedLayer = Omit<Layer, 'clipId'> & { role: LayerRole; clipId: string };

const HEX = /^#[0-9a-fA-F]{6}$/;
const CHANNELS = [1, 3, 5] as const;
const MIDPOINT = 0.5;

const lerp = (a: number, b: number, t: number): number => a * (1 - t) + b * t;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function mixColor(a: string, b: string, t: number): string {
  if (!HEX.test(a) || !HEX.test(b)) {
    return t < MIDPOINT ? a : b;
  }
  const mixed = CHANNELS.map((i) => Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), t)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function matched(from: Layer, to: Layer, t: number): AnimatedLayer {
  return {
    role: LayerRole.Matched,
    key: to.key,
    clipId: to.clipId,
    component: to.component,
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    rotation: lerp(from.rotation, to.rotation, t),
    opacity: lerp(from.opacity, to.opacity, t),
    fill: mixColor(from.fill, to.fill, t),
    radius: lerp(from.radius, to.radius, t)
  };
}

const leaving = (layer: Layer, t: number): AnimatedLayer => ({ ...layer, role: LayerRole.Leaving, opacity: layer.opacity * (1 - t) });
const entering = (layer: Layer, t: number): AnimatedLayer => ({ ...layer, role: LayerRole.Entering, opacity: layer.opacity * t });

export function smartAnimate(source: MotionDoc, target: MotionDoc, progress: number, ease: string): AnimatedLayer[] {
  const t = easeCurve(ease)(clamp01(progress));
  const fromLayers = layersOf(source);
  const toLayers = layersOf(target);
  const partner = (layer: Layer, others: Layer[]) => others.find((o) => o.key === layer.key && o.component === layer.component);
  const pairs = toLayers.map((to) => ({ to, from: partner(to, fromLayers) }));
  const taken = new Set(pairs.flatMap((p) => (p.from ? [p.from.key] : [])));

  return [
    ...fromLayers.filter((l) => !taken.has(l.key)).map((l) => leaving(l, t)),
    ...pairs.map((p) => (p.from ? matched(p.from, p.to, t) : entering(p.to, t)))
  ];
}
