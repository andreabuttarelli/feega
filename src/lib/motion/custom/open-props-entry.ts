import Easings from 'open-props/src/props.easing.js';
import Sizes from 'open-props/src/props.sizes.js';
import Shadows from 'open-props/src/props.shadows.js';
import Gradients from 'open-props/src/props.gradients.js';
import Animations from 'open-props/src/props.animations.js';
import { OPEN_PROPS_GLOBAL } from './open-props';

type Ease = (p: number) => number;
type Timeline = { to: (target: object, vars: object, at: number) => void; fromTo: (target: object, from: object, to: object, at: number) => void };
type Clip = { tl: Timeline; registerEase: (name: string, ease: Ease) => void };
type Frame = { offset: number; values: Record<string, number | string> };
type Animate = { at?: number; duration?: number; ease?: string; iterations?: number };

const NOTICE = 'Open Props 1.7.23, Copyright (c) 2021 Adam Argyle, MIT licence';
const LEFT_OUT = /inner-shadow|@media|^--noise/;
const NEWTON_STEPS = 8;
const BISECTION_STEPS = 30;

const IDENTITY: Record<string, number> = { xPercent: 0, yPercent: 0, scale: 1, rotation: 0 };

const TRANSFORMS: [RegExp, (n: number[], unit: string) => Record<string, number>][] = [
  [/^translateX\(([-\d.]+)(%?)\)$/, ([n]) => ({ xPercent: n })],
  [/^translateY\(([-\d.]+)(%?)\)$/, ([n]) => ({ yPercent: n })],
  [/^scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)$/, ([n]) => ({ scale: n })],
  [/^rotate\(([-\d.]+)(deg|turn)\)$/, ([n], unit) => ({ rotation: unit === 'turn' ? n * 360 : n })]
];

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < NEWTON_STEPS; i++) {
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) {
        break;
      }
      t -= (at(x1, x2, t) - x) / d;
    }
    if (t >= 0 && t <= 1 && Math.abs(at(x1, x2, t) - x) < 1e-6) {
      return t;
    }
    let [lo, hi] = [0, 1];
    for (let i = 0; i < BISECTION_STEPS; i++) {
      t = (lo + hi) / 2;
      [lo, hi] = at(x1, x2, t) < x ? [t, hi] : [lo, t];
    }
    return t;
  };
  return (p) => (p <= 0 || p >= 1 ? p : at(y1, y2, solve(p)));
}

function piecewise(list: string): Ease {
  const stops = list.split(',').map((part) => {
    const [value, at] = part.trim().split(/\s+/);
    return { value: Number(value), at: at === undefined ? NaN : parseFloat(at) / 100 };
  });
  stops[0].at = Number.isNaN(stops[0].at) ? 0 : stops[0].at;
  stops[stops.length - 1].at = Number.isNaN(stops[stops.length - 1].at) ? 1 : stops[stops.length - 1].at;
  for (let i = 1; i < stops.length - 1; i++) {
    if (!Number.isNaN(stops[i].at)) {
      continue;
    }
    const next = stops.findIndex((s, j) => j > i && !Number.isNaN(s.at));
    const from = stops[i - 1].at;
    stops[i].at = from + (stops[next].at - from) / (next - i + 1);
  }
  return (p) => {
    const i = stops.findIndex((s) => s.at >= p);
    if (i <= 0) {
      return i === 0 ? stops[0].value : stops[stops.length - 1].value;
    }
    const [a, b] = [stops[i - 1], stops[i]];
    return b.at === a.at ? b.value : a.value + ((b.value - a.value) * (p - a.at)) / (b.at - a.at);
  };
}

const EASE_FORMS: [RegExp, (args: string) => Ease][] = [
  [/^cubic-bezier\((.*)\)$/s, (args) => cubicBezier(...(args.split(',').map(Number) as [number, number, number, number]))],
  [/^linear\((.*)\)$/s, piecewise],
  [/^steps\((\d+)/, (args) => (p) => Math.min(1, Math.floor(p * Number(args)) / Number(args))]
];

function easeOf(value: string, all: Record<string, string>): Ease | null {
  const text = value.trim();
  const alias = /^var\((--[\w-]+)\)$/.exec(text);
  if (alias) {
    return all[alias[1]] ? easeOf(all[alias[1]], all) : null;
  }
  for (const [pattern, make] of EASE_FORMS) {
    const match = pattern.exec(text);
    if (match) {
      return make(match[1]);
    }
  }
  return null;
}

const EASES = Object.entries(Easings as Record<string, string>)
  .map(([name, value]) => [name.slice(2), easeOf(value, Easings as Record<string, string>)] as const)
  .filter((entry): entry is readonly [string, Ease] => entry[1] !== null);

function valuesOf(block: string): Record<string, number | string> {
  const values: Record<string, number | string> = {};
  for (const declaration of block.split(';')) {
    const [property, ...rest] = declaration.split(':');
    const value = rest.join(':').trim();
    if (!property.trim() || !value) {
      continue;
    }
    const name = property.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (name !== 'transform') {
      values[name] = Number.isNaN(Number(value)) ? value : Number(value);
      continue;
    }
    for (const [pattern, map] of TRANSFORMS) {
      const match = pattern.exec(value);
      if (match) {
        Object.assign(values, map(match.slice(1, -1).filter(Boolean).map(Number), match[match.length - 1] ?? ''));
      }
    }
  }
  return values;
}

const OFFSETS: Record<string, number> = { from: 0, to: 1 };

function framesOf(css: string): Frame[] {
  const frames: Frame[] = [];
  for (const [, selectors, block] of css.matchAll(/([\w%,.\s]+)\{([^{}]*)\}/g)) {
    const values = valuesOf(block);
    for (const selector of selectors.split(',')) {
      const key = selector.trim();
      frames.push({ offset: key in OFFSETS ? OFFSETS[key] : parseFloat(key) / 100, values });
    }
  }
  return frames.sort((a, b) => a.offset - b.offset);
}

const KEYFRAMES = Object.fromEntries(
  Object.entries(Animations as Record<string, string>)
    .filter(([name]) => name.endsWith('-@'))
    .map(([name, css]) => [name.slice('--animation-'.length, -2), framesOf(css.replace(/^[^{]*\{/, '').replace(/\}\s*$/, ''))])
);

const DEFAULTS = Object.fromEntries(
  Object.entries(Animations as Record<string, string>)
    .filter(([name]) => !name.includes('@'))
    .map(([name, value]) => {
      const [, seconds, ease] = /\s([\d.]+)s\s+var\(--([\w-]+)\)/.exec(value) ?? [];
      return [name.slice('--animation-'.length), { duration: Number(seconds) || 1, ease: ease ?? 'none' }];
    })
);

function tokens(): string {
  const all = { ...(Sizes as Record<string, string>), ...(Shadows as Record<string, string>), ...(Gradients as Record<string, string>), ...(Easings as Record<string, string>) };
  return Object.entries(all)
    .filter(([name]) => !LEFT_OUT.test(name))
    .map(([name, value]) => `${name}:${value.replace(/\s+/g, ' ').trim()};`)
    .join('');
}

function openProps({ tl, registerEase }: Clip) {
  for (const [name, ease] of EASES) {
    registerEase(name, ease);
  }

  const animate = (el: HTMLElement, name: string, { at = 0, iterations = 1, ...timing }: Animate = {}) => {
    const frames = KEYFRAMES[name];
    if (!frames) {
      throw new Error(`OpenProps.animate: no animation "${name}"; one of ${Object.keys(KEYFRAMES).join(', ')}`);
    }
    const { duration, ease } = { ...DEFAULTS[name], ...timing };
    const properties = [...new Set(frames.flatMap((f) => Object.keys(f.values)))];
    for (let round = 0; round < iterations; round++) {
      const start = at + round * duration;
      for (const property of properties) {
        const track = frames.filter((f) => property in f.values).map((f) => ({ offset: f.offset, value: f.values[property] }));
        if (track[0].offset > 0 && property in IDENTITY) {
          track.unshift({ offset: 0, value: IDENTITY[property] });
        }
        if (track[track.length - 1].offset < 1 && property in IDENTITY) {
          track.push({ offset: 1, value: IDENTITY[property] });
        }
        if (track[0].offset > 0) {
          tl.to(el, { [property]: track[0].value, duration: track[0].offset * duration, ease }, start);
        }
        for (let i = 0; i + 1 < track.length; i++) {
          const [a, b] = [track[i], track[i + 1]];
          tl.fromTo(el, { [property]: a.value }, { [property]: b.value, duration: Math.max(0.0001, (b.offset - a.offset) * duration), ease, immediateRender: false }, start + a.offset * duration);
        }
      }
    }
    return el;
  };

  return { animate, animations: Object.keys(KEYFRAMES), easings: EASES.map(([name]) => name) };
}

const style = document.createElement('style');
style.textContent = `:root{${tokens()}}`;
document.head.appendChild(style);

(window as unknown as Record<string, unknown>)[OPEN_PROPS_GLOBAL] = Object.assign(openProps, { notices: [NOTICE] });
