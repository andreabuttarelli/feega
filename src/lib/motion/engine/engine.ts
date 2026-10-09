export const ENGINE_GLOBAL = '__feegaMotion';

export type EaseFn = (p: number) => number;
type Vars = Record<string, unknown>;
type Target = Record<string, unknown>;
type Styled = Target & {
  style: CSSStyleDeclaration & Record<string, string>;
  getAttribute: (n: string) => string | null;
  setAttribute: (n: string, v: string) => void;
};
type Slot = { color: boolean; value: number };
type Complex = { parts: string[]; slots: Slot[] };
type Value = { kind: 'number'; n: number; unit: string } | { kind: 'complex'; c: Complex; raw: string } | { kind: 'plain'; raw: unknown };
type Raw = unknown;

type Segment = {
  order: number;
  start: number;
  dur: number;
  ease: EaseFn;
  from: Raw;
  to: Raw;
  lazyFrom: boolean;
  immediate: boolean;
  repeat: number;
  yoyo: boolean;
  repeatDelay: number;
  resolved?: { value: unknown };
};

type Channel = {
  target: Target;
  prop: string;
  segments: Segment[];
  snapshot: Raw;
  snapped: boolean;
  written: boolean;
};

type TweenItem = {
  kind: 'tween';
  order: number;
  start: number;
  dur: number;
  repeat: number;
  yoyo: boolean;
  repeatDelay: number;
  ease: EaseFn;
  targets: Target[];
  vars: Vars;
  onUpdate: ((this: unknown) => void) | null;
  segments: Segment[];
  handle: Handle;
};

type ChildItem = {
  kind: 'child';
  order: number;
  start: number;
  dur: number;
  render: (local: number) => void;
  handle: Handle;
};
type Item = TweenItem | ChildItem;
type Handle = Record<string, unknown>;

export type MotionEngine = {
  timeline: (vars?: Vars) => Handle;
  set: (targets: unknown, vars: Vars) => void;
  parseEase: (ease: unknown) => EaseFn;
  registerEase: (name: string, fn: EaseFn) => void;
  utils: {
    interpolate: (a: unknown, b: unknown, p: number) => unknown;
    clamp: (min: number, max: number, v: number) => number;
    mapRange: (a: number, b: number, c: number, d: number, v: number) => number;
    toArray: (t: unknown) => unknown[];
  };
  split: (
    target: unknown,
    vars?: Vars
  ) => {
    chars: HTMLElement[];
    words: HTMLElement[];
    lines: HTMLElement[];
    revert: () => void;
  };
  SplitText: unknown;
  drawPath: (target: unknown) => Record<'start' | 'draw', number>;
  morph: (target: unknown, to: string, vars?: { points?: number }) => Record<'morph', number>;
  scramble: (target: unknown, text: string, vars?: { seed?: number; chars?: string }) => Record<'reveal', number>;
  flip: (targets: unknown, change: () => void) => Record<'flip', number>;
};

export function motionEngine(win: Window & Record<string, unknown>): MotionEngine {
  const doc = win.document;
  const PRECISION = 10000;
  const TINY = 1e-8;
  const DEFAULT_DURATION = 0.5;
  const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
  const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v));

  const fromIn = (easeIn: EaseFn) => ({
    in: easeIn,
    out: (p: number) => 1 - easeIn(1 - p),
    inOut: (p: number) => (p < 0.5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2)
  });
  const fromOut = (easeOut: EaseFn) => ({
    in: (p: number) => 1 - easeOut(1 - p),
    out: easeOut,
    inOut: (p: number) => (p < 0.5 ? (1 - easeOut(1 - p * 2)) / 2 : 0.5 + easeOut((p - 0.5) * 2) / 2)
  });
  const power = (n: number) => fromIn((p) => p ** n);
  const back = (overshoot = 1.70158) => fromIn((p) => (p ? p * p * ((overshoot + 1) * p - overshoot) : 0));
  const elasticOut = (amplitude: number, period: number) => {
    const p1 = amplitude >= 1 ? amplitude : 1;
    const raw = period / (amplitude < 1 ? amplitude : 1);
    const p3 = (raw / (Math.PI * 2)) * (Math.asin(1 / p1) || 0);
    const p2 = (Math.PI * 2) / raw;
    return (p: number) => (p === 1 ? 1 : p1 * 2 ** (-10 * p) * Math.sin((p - p3) * p2) + 1);
  };
  const elastic = (amplitude = 1, period?: number) => ({
    in: fromOut(elasticOut(amplitude, period || 0.3)).in,
    out: elasticOut(amplitude, period || 0.3),
    inOut: fromOut(elasticOut(amplitude, period || 0.45)).inOut
  });
  const bounceOut = (p: number) => {
    const n = 7.5625;
    const c = 2.75;
    if (p < 1 / c) {
      return n * p * p;
    }
    if (p < 2 / c) {
      return n * (p - 1.5 / c) ** 2 + 0.75;
    }
    if (p < 2.5 / c) {
      return n * (p - 2.25 / c) ** 2 + 0.9375;
    }
    return n * (p - 2.625 / c) ** 2 + 0.984375;
  };
  const steps = (count = 1, immediateStart = false) => {
    const size = 1 / count;
    const span = count + (immediateStart ? 0 : 1);
    const lift = immediateStart ? 1 : 0;
    return (p: number) => (((span * clamp(0, 1 - TINY, p)) | 0) + lift) * size;
  };
  const linear = (p: number) => p;
  const expoIn = (p: number) => 2 ** (10 * (p - 1)) * p + p ** 6 * (1 - p);
  const settled = (ease: EaseFn, depth: number, lateness: number) => (p: number) => ease(p) + depth * p ** lateness * (1 - p);
  const house = () => {
    const expo = fromIn(expoIn);
    return { in: expo.in, out: settled(expo.out, 0.2, 6), inOut: settled(expo.inOut, 0.35, 12) };
  };

  type Family = (args: number[]) => { in: EaseFn; out: EaseFn; inOut: EaseFn };
  const FAMILIES: Record<string, Family> = {
    none: () => ({ in: linear, out: linear, inOut: linear }),
    linear: () => ({ in: linear, out: linear, inOut: linear }),
    power0: () => ({ in: linear, out: linear, inOut: linear }),
    power1: () => power(2),
    quad: () => power(2),
    power2: () => power(3),
    cubic: () => power(3),
    power3: () => power(4),
    quart: () => power(4),
    power4: () => power(5),
    quint: () => power(5),
    strong: () => power(5),
    sine: () => fromIn((p) => (p === 1 ? 1 : -Math.cos(p * (Math.PI / 2)) + 1)),
    expo: () => fromIn(expoIn),
    feega: house,
    circ: () => fromIn((p) => -(Math.sqrt(1 - p * p) - 1)),
    back: (a) => back(a[0]),
    elastic: (a) => elastic(a[0], a[1]),
    bounce: () => fromOut(bounceOut)
  };
  const TYPES: Record<string, 'in' | 'out' | 'inOut'> = {
    in: 'in',
    out: 'out',
    inout: 'inOut',
    easein: 'in',
    easeout: 'out',
    easeinout: 'inOut'
  };
  const custom: Record<string, EaseFn> = {};
  const parsed: Record<string, EaseFn> = {};
  const DEFAULT_EASE = house().out;

  function parseEase(ease: unknown): EaseFn {
    if (typeof ease === 'function') {
      return ease as EaseFn;
    }
    if (typeof ease !== 'string' || !ease) {
      return DEFAULT_EASE;
    }
    if (custom[ease]) {
      return custom[ease];
    }
    if (parsed[ease]) {
      return parsed[ease];
    }
    const m = /^([a-z0-9]+)(?:\.([a-z]+))?\s*(?:\(([^)]*)\))?$/i.exec(ease.trim());
    if (!m) {
      return DEFAULT_EASE;
    }
    const name = m[1].toLowerCase();
    const args = (m[3] ?? '')
      .split(',')
      .filter((s) => s.trim() !== '')
      .map(Number);
    if (name === 'steps') {
      return (parsed[ease] = steps(args[0], Boolean(args[1])));
    }
    const family = FAMILIES[name];
    if (!family) {
      return DEFAULT_EASE;
    }
    const type = TYPES[(m[2] ?? 'out').toLowerCase()] ?? 'out';
    return (parsed[ease] = family(args)[type]);
  }

  const NAMED: Record<string, number[]> = {
    aqua: [0, 255, 255, 1],
    lime: [0, 255, 0, 1],
    silver: [192, 192, 192, 1],
    black: [0, 0, 0, 1],
    maroon: [128, 0, 0, 1],
    teal: [0, 128, 128, 1],
    blue: [0, 0, 255, 1],
    navy: [0, 0, 128, 1],
    white: [255, 255, 255, 1],
    olive: [128, 128, 0, 1],
    yellow: [255, 255, 0, 1],
    orange: [255, 165, 0, 1],
    gray: [128, 128, 128, 1],
    purple: [128, 0, 128, 1],
    green: [0, 128, 0, 1],
    red: [255, 0, 0, 1],
    pink: [255, 192, 203, 1],
    cyan: [0, 255, 255, 1],
    transparent: [255, 255, 255, 0]
  };

  function hsl(h: number, s: number, l: number): number[] {
    const hue = (((h % 360) + 360) % 360) / 360;
    const q = l <= 0.5 ? l * (s + 1) : l + s - l * s;
    const p = l * 2 - q;
    const channel = (t: number) => {
      const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      const v = x * 6 < 1 ? p + (q - p) * x * 6 : x < 0.5 ? q : x * 3 < 2 ? p + (q - p) * (2 / 3 - x) * 6 : p;
      return Math.round(v * 255);
    };
    return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
  }

  function rgba(token: string): number[] | null {
    const t = token.trim().toLowerCase();
    if (NAMED[t]) {
      return NAMED[t].slice();
    }
    if (t[0] === '#') {
      const hex = t.slice(1);
      const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
      const n = full.match(/../g)!.map((h) => parseInt(h, 16));
      return [n[0], n[1], n[2], n.length > 3 ? round(n[3] / 255) : 1];
    }
    const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(t);
    if (!fn) {
      return null;
    }
    const nums = fn[2]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((s) => parseFloat(s));
    const alpha = nums.length > 3 ? nums[3] : 1;
    if (fn[1][0] === 'h') {
      return [...hsl(nums[0], nums[1] / 100, nums[2] / 100), alpha];
    }
    return [nums[0], nums[1], nums[2], alpha];
  }

  const TOKEN = new RegExp(`#[0-9a-f]{3,8}\\b|(?:rgb|hsl)a?\\([^)]*\\)|\\b(?:${Object.keys(NAMED).join('|')})\\b|[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:e[-+]?\\d+)?`, 'gi');

  function complex(raw: string): Complex {
    const parts: string[] = [];
    const slots: Slot[] = [];
    let last = 0;
    let literal = '';
    for (const m of raw.matchAll(TOKEN)) {
      literal += raw.slice(last, m.index);
      last = (m.index ?? 0) + m[0].length;
      const color = /^[-+.\d]/.test(m[0]) ? null : rgba(m[0]);
      if (!color && !/^[-+.\d]/.test(m[0])) {
        literal += m[0];
        continue;
      }
      parts.push(literal);
      literal = '';
      if (color) {
        parts.push('', '', '');
        color.forEach((value) => slots.push({ color: true, value }));
        continue;
      }
      slots.push({ color: false, value: parseFloat(m[0]) });
    }
    parts.push(literal + raw.slice(last));
    return { parts, slots };
  }

  function joinComplex(c: Complex, values: number[]): string {
    let out = c.parts[0];
    let i = 0;
    while (i < c.slots.length) {
      if (c.slots[i].color) {
        const [r, g, b, a] = values.slice(i, i + 4);
        out += `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${round(a)})` + c.parts[i + 4];
        i += 4;
        continue;
      }
      out += String(round(values[i])) + c.parts[i + 1];
      i += 1;
    }
    return out;
  }

  const NUMBER = /^([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?)([a-z%]*)$/i;

  function valueOf(raw: unknown): Value {
    if (typeof raw === 'number') {
      return { kind: 'number', n: raw, unit: '' };
    }
    if (typeof raw !== 'string') {
      return { kind: 'plain', raw };
    }
    const m = NUMBER.exec(raw.trim());
    if (m) {
      return { kind: 'number', n: parseFloat(m[1]), unit: m[2] };
    }
    return { kind: 'complex', c: complex(raw), raw };
  }

  function sameShape(a: Complex, b: Complex): boolean {
    return a.slots.length === b.slots.length && a.slots.every((s, i) => s.color === b.slots[i].color);
  }

  function interpolate(a: unknown, b: unknown, p: number): unknown {
    const from = valueOf(a);
    const to = valueOf(b);
    if (from.kind === 'number' && to.kind === 'number') {
      const n = round(from.n + (to.n - from.n) * p);
      return typeof b === 'number' ? n : `${n}${to.unit || from.unit}`;
    }
    if (from.kind === 'complex' && to.kind === 'complex' && sameShape(from.c, to.c)) {
      if (p === 1) {
        return b;
      }
      return joinComplex(
        to.c,
        to.c.slots.map((s, i) => from.c.slots[i].value + (s.value - from.c.slots[i].value) * p)
      );
    }
    if (from.kind !== 'plain' && to.kind !== 'plain') {
      const fc = from.kind === 'complex' ? from.c : complex(String(a));
      const tc = to.kind === 'complex' ? to.c : complex(String(b));
      if (sameShape(fc, tc) && tc.slots.length) {
        return p === 1
          ? b
          : joinComplex(
              tc,
              tc.slots.map((s, i) => fc.slots[i].value + (s.value - fc.slots[i].value) * p)
            );
      }
    }
    return p >= 1 ? b : a;
  }

  enum Kind {
    Transform = 'transform',
    Style = 'style',
    Var = 'var',
    Attr = 'attr',
    Field = 'field',
    AutoAlpha = 'autoAlpha'
  }

  const TRANSFORM_KEYS: Record<string, string> = {
    x: 'x',
    y: 'y',
    z: 'z',
    xPercent: 'xPercent',
    yPercent: 'yPercent',
    rotation: 'rotation',
    rotate: 'rotation',
    rotationZ: 'rotation',
    rotateZ: 'rotation',
    rotationX: 'rotationX',
    rotateX: 'rotationX',
    rotationY: 'rotationY',
    rotateY: 'rotationY',
    scaleX: 'scaleX',
    scaleY: 'scaleY',
    skewX: 'skewX',
    skewY: 'skewY',
    transformPerspective: 'perspective'
  };
  const UNITLESS = new Set([
    'opacity',
    'zIndex',
    'fontWeight',
    'lineHeight',
    'flexGrow',
    'flexShrink',
    'order',
    'zoom',
    'fillOpacity',
    'strokeOpacity',
    'stopOpacity',
    'strokeMiterlimit',
    'orphans',
    'widows',
    'columnCount'
  ]);
  const RESERVED = new Set([
    'duration',
    'ease',
    'delay',
    'stagger',
    'repeat',
    'yoyo',
    'repeatDelay',
    'immediateRender',
    'lazy',
    'overwrite',
    'onUpdate',
    'onComplete',
    'onStart',
    'onRepeat',
    'onReverseComplete',
    'onUpdateParams',
    'onCompleteParams',
    'onStartParams',
    'callbackScope',
    'paused',
    'id',
    'data',
    'inherit',
    'runBackwards',
    'startAt',
    'modifiers',
    'snap',
    'force3D',
    'autoRound'
  ]);

  const isElement = (t: Target): t is Styled => !!t && typeof t === 'object' && 'style' in t && typeof (t as Styled).getAttribute === 'function';
  const kebab = (p: string) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  type TransformCache = Record<string, number> & { mid: number };
  const transforms = new WeakMap<Target, TransformCache>();

  function decompose(el: Styled): TransformCache {
    const cache: TransformCache = {
      x: 0,
      y: 0,
      z: 0,
      xPercent: 0,
      yPercent: 0,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      perspective: 0,
      mid: 0
    };
    const view = doc.defaultView;
    const computed = view ? view.getComputedStyle(el as unknown as Element).transform : '';
    const m = /^matrix(3d)?\(([^)]*)\)$/.exec(computed || '');
    if (m) {
      const n = m[2].split(',').map(Number);
      const [a, b, c, d, e, f] = m[1] ? [n[0], n[1], n[4], n[5], n[12], n[13]] : n;
      cache.scaleX = round(Math.sqrt(a * a + b * b));
      cache.scaleY = round(Math.sqrt(d * d + c * c));
      cache.rotation = a || b ? round((Math.atan2(b, a) * 180) / Math.PI) : 0;
      const skew = a || b ? Math.atan2(c, d) * (180 / Math.PI) + cache.rotation : 0;
      cache.skewX = skew ? round(skew) : 0;
      cache.x = round(e);
      cache.y = round(f);
      cache.z = m[1] ? round(n[14]) : 0;
      const box = el as unknown as HTMLElement;
      if (box.offsetWidth && Math.round(box.offsetWidth / 2) === Math.round(-cache.x) && /-50%/.test(el.style.transform || '')) {
        cache.xPercent = -50;
        cache.x = 0;
      }
      if (box.offsetHeight && Math.round(box.offsetHeight / 2) === Math.round(-cache.y) && /-50%\s*\)/.test(el.style.transform || '')) {
        cache.yPercent = -50;
        cache.y = 0;
      }
    }
    el.style.translate = 'none';
    el.style.rotate = 'none';
    el.style.scale = 'none';
    return cache;
  }

  function transformOf(el: Styled): TransformCache {
    let cache = transforms.get(el);
    if (!cache) {
      cache = decompose(el);
      transforms.set(el, cache);
    }
    return cache;
  }

  function writeTransform(el: Styled, cache: TransformCache) {
    const px = (v: number) => `${v}px`;
    const deg = (v: number) => `${v}deg`;
    const use3D = cache.mid > 0;
    let out = '';
    if (cache.perspective) {
      out += `perspective(${px(cache.perspective)}) `;
    }
    if (cache.xPercent || cache.yPercent) {
      out += `translate(${cache.xPercent}%, ${cache.yPercent}%) `;
    }
    if (use3D || cache.x || cache.y || cache.z) {
      out += cache.z || use3D ? `translate3d(${px(cache.x)}, ${px(cache.y)}, ${px(cache.z)}) ` : `translate(${px(cache.x)}, ${px(cache.y)}) `;
    }
    if (cache.rotation) {
      out += `rotate(${deg(cache.rotation)}) `;
    }
    if (cache.rotationY) {
      out += `rotateY(${deg(cache.rotationY)}) `;
    }
    if (cache.rotationX) {
      out += `rotateX(${deg(cache.rotationX)}) `;
    }
    if (cache.skewX || cache.skewY) {
      out += `skew(${deg(cache.skewX)}, ${deg(cache.skewY)}) `;
    }
    if (cache.scaleX !== 1 || cache.scaleY !== 1) {
      out += `scale(${cache.scaleX}, ${cache.scaleY}) `;
    }
    el.style.transform = out.trim() || 'translate(0px, 0px)';
  }

  function kindOf(target: Target, prop: string): Kind {
    if (prop.startsWith('attr:')) {
      return Kind.Attr;
    }
    if (!isElement(target)) {
      return Kind.Field;
    }
    if (prop in TRANSFORM_KEYS) {
      return Kind.Transform;
    }
    if (prop === 'autoAlpha') {
      return Kind.AutoAlpha;
    }
    return prop.startsWith('--') ? Kind.Var : Kind.Style;
  }

  const READ: Record<Kind, (t: Target, prop: string) => unknown> = {
    [Kind.Transform]: (t, prop) => transformOf(t as Styled)[TRANSFORM_KEYS[prop]],
    [Kind.Style]: (t, prop) => {
      const view = doc.defaultView;
      const el = t as Styled;
      return el.style[prop] || (view ? view.getComputedStyle(el as unknown as Element)[prop as never] : '') || '';
    },
    [Kind.Var]: (t, prop) => {
      const el = t as Styled;
      const view = doc.defaultView;
      return (el.style.getPropertyValue(prop) || (view ? view.getComputedStyle(el as unknown as Element).getPropertyValue(prop) : '')).trim();
    },
    [Kind.Attr]: (t, prop) => (typeof t.getAttribute === 'function' ? ((t as Styled).getAttribute(prop.slice(5)) ?? '') : t[prop.slice(5)]),
    [Kind.Field]: (t, prop) => t[prop],
    [Kind.AutoAlpha]: (t) => READ[Kind.Style](t, 'opacity')
  };

  function cssValue(prop: string, v: unknown): string {
    return typeof v === 'number' ? `${v}${UNITLESS.has(prop) ? '' : 'px'}` : String(v);
  }

  const WRITE: Record<Kind, (t: Target, prop: string, v: unknown, mid: boolean) => void> = {
    [Kind.Transform]: (t, prop, v, mid) => {
      const cache = transformOf(t as Styled);
      cache[TRANSFORM_KEYS[prop]] = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
      if (mid) {
        cache.mid += 1;
      }
    },
    [Kind.Style]: (t, prop, v) => {
      (t as Styled).style[prop] = cssValue(prop, v);
    },
    [Kind.Var]: (t, prop, v) => (t as Styled).style.setProperty(prop, String(v)),
    [Kind.Attr]: (t, prop, v) => {
      if (typeof t.setAttribute === 'function') {
        (t as Styled).setAttribute(prop.slice(5), String(v));
        return;
      }
      t[prop.slice(5)] = v;
    },
    [Kind.Field]: (t, prop, v) => {
      t[prop] = v;
    },
    [Kind.AutoAlpha]: (t, _prop, v) => {
      const el = t as Styled;
      el.style.opacity = String(v);
      el.style.visibility = Number(v) ? 'inherit' : 'hidden';
    }
  };

  function resolveTargets(targets: unknown): Target[] {
    if (targets == null) {
      return [];
    }
    if (typeof targets === 'string') {
      return Array.from(doc.querySelectorAll(targets)) as unknown as Target[];
    }
    if (Array.isArray(targets)) {
      return targets.flatMap(resolveTargets);
    }
    const list = targets as { length?: number; item?: unknown };
    if (typeof list.length === 'number' && typeof list.item === 'function') {
      return Array.from(targets as ArrayLike<Target>);
    }
    return [targets as Target];
  }

  function expand(vars: Vars): Vars {
    const out: Vars = {};
    for (const [key, value] of Object.entries(vars)) {
      if (RESERVED.has(key)) {
        continue;
      }
      if (key === 'attr' && value && typeof value === 'object') {
        for (const [a, v] of Object.entries(value as Vars)) {
          out[`attr:${a}`] = v;
        }
        continue;
      }
      if (key === 'css' && value && typeof value === 'object') {
        Object.assign(out, expand(value as Vars));
        continue;
      }
      if (key === 'scale') {
        out.scaleX = value;
        out.scaleY = value;
        continue;
      }
      out[key] = value;
    }
    return out;
  }

  function relative(from: unknown, to: unknown): unknown {
    if (typeof to !== 'string') {
      return to;
    }
    const m = /^([-+*/])=\s*(.*)$/.exec(to);
    if (!m) {
      return to;
    }
    const base = valueOf(from);
    const delta = valueOf(m[2]);
    if (base.kind !== 'number' || delta.kind !== 'number') {
      return m[2];
    }
    const op: Record<string, (a: number, b: number) => number> = {
      '+': (a, b) => a + b,
      '-': (a, b) => a - b,
      '*': (a, b) => a * b,
      '/': (a, b) => a / b
    };
    const n = round(op[m[1]](base.n, delta.n));
    const unit = delta.unit || base.unit;
    return unit ? `${n}${unit}` : n;
  }

  function convertUnit(target: Target, prop: string, from: unknown, to: unknown): unknown {
    const f = valueOf(from);
    const t = valueOf(to);
    if (!isElement(target) || f.kind !== 'number' || t.kind !== 'number' || !f.unit || !t.unit || f.unit === t.unit || f.unit !== 'px') {
      return from;
    }
    const el = target as Styled;
    const before = el.style[prop];
    el.style[prop] = `100${t.unit}`;
    const view = doc.defaultView;
    const probe = parseFloat(view ? view.getComputedStyle(el as unknown as Element)[prop as never] : '');
    el.style[prop] = before;
    return probe ? `${round((f.n / probe) * 100)}${t.unit}` : from;
  }

  function numericFor(kind: Kind, v: unknown): unknown {
    if (kind !== Kind.Transform) {
      return v;
    }
    const value = valueOf(v);
    if (value.kind !== 'number') {
      return v;
    }
    const factor: Record<string, number> = {
      rad: 180 / Math.PI,
      turn: 360,
      grad: 0.9
    };
    return value.n * (factor[value.unit] ?? 1);
  }

  function timeline(tlVars: Vars = {}): Handle {
    const items: Item[] = [];
    const channels: Channel[] = [];
    const byTarget = new Map<Target, Map<string, Channel>>();
    const labels: Record<string, number> = {};
    let counter = 0;
    let time = 0;
    let duration = 0;
    let previous: { start: number; end: number } = { start: 0, end: 0 };
    let playing = false;
    let speed = 1;
    let frame = 0;
    let clock = 0;

    function channelOf(target: Target, prop: string): Channel {
      let props = byTarget.get(target);
      if (!props) {
        props = new Map();
        byTarget.set(target, props);
      }
      let channel = props.get(prop);
      if (!channel) {
        channel = {
          target,
          prop,
          segments: [],
          snapshot: undefined,
          snapped: false,
          written: false
        };
        props.set(prop, channel);
        channels.push(channel);
      }
      return channel;
    }

    function position(pos: unknown): number {
      if (typeof pos === 'number') {
        return pos;
      }
      if (typeof pos !== 'string' || pos === '') {
        return duration;
      }
      const m = /^(<|>)?([^+\-<>]*?)?\s*(?:([-+])=?\s*([\d.]+))?$/.exec(pos.trim());
      if (!m) {
        return duration;
      }
      const offset = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
      if (m[1]) {
        return (m[1] === '<' ? previous.start : previous.end) + offset;
      }
      if (m[2]) {
        return (m[2] in labels ? labels[m[2]] : duration) + offset;
      }
      return duration + offset;
    }

    function track(start: number, end: number) {
      previous = { start, end };
      duration = Math.max(duration, end);
    }

    function totalOf(dur: number, repeat: number, repeatDelay: number): number {
      return repeat < 0 ? Infinity : dur * (repeat + 1) + repeatDelay * repeat;
    }

    function localTime(
      t: number,
      item: {
        start: number;
        dur: number;
        repeat: number;
        yoyo: boolean;
        repeatDelay: number;
      }
    ): number {
      const elapsed = t - item.start;
      if (elapsed <= 0) {
        return 0;
      }
      if (!item.repeat) {
        return Math.min(elapsed, item.dur);
      }
      const total = totalOf(item.dur, item.repeat, item.repeatDelay);
      const clamped = Math.min(elapsed, total);
      const cycle = item.dur + item.repeatDelay;
      const index = clamped >= total ? (item.repeat < 0 ? 0 : item.repeat) : Math.floor(clamped / cycle);
      const within = clamped >= total ? item.dur : Math.min(clamped - index * cycle, item.dur);
      return item.yoyo && index % 2 ? item.dur - within : within;
    }

    function handleOf(item: TweenItem): Handle {
      const h: Handle = {
        vars: item.vars,
        time: () => localTime(time, item),
        totalTime: () => Math.max(0, Math.min(time - item.start, totalOf(item.dur, item.repeat, item.repeatDelay))),
        progress: () => (item.dur ? localTime(time, item) / item.dur : time >= item.start ? 1 : 0),
        duration: () => item.dur,
        totalDuration: () => totalOf(item.dur, item.repeat, item.repeatDelay),
        startTime: () => item.start,
        targets: () => item.targets,
        parent: api,
        invalidate: () => {
          item.ease = item.vars.ease === undefined ? item.ease : parseEase(item.vars.ease);
          item.segments.forEach((segment) => (segment.ease = item.ease));
          return h;
        },
        isActive: () => false,
        kill: () => h,
        pause: () => h,
        play: () => h
      };
      Object.defineProperty(h, 'ratio', {
        get: () => item.ease(item.dur ? localTime(time, item) / item.dur : 1)
      });
      return h;
    }

    function addTween(targets: unknown, from: Vars | null, to: Vars, pos: unknown, mode: 'to' | 'from' | 'fromTo' | 'set') {
      const list = resolveTargets(targets);
      const dur = mode === 'set' ? 0 : Math.max(0, Number(to.duration ?? DEFAULT_DURATION));
      const base = position(pos) + Number(to.delay ?? 0);
      const ease = mode === 'set' ? linear : parseEase(to.ease);
      const repeat = Number(to.repeat ?? 0) | 0;
      const yoyo = Boolean(to.yoyo);
      const repeatDelay = Number(to.repeatDelay ?? 0);
      const defaultImmediate = mode === 'from' || mode === 'fromTo';
      const immediate = to.immediateRender === undefined ? defaultImmediate : Boolean(to.immediateRender);
      const onUpdate = typeof to.onUpdate === 'function' ? (to.onUpdate as (this: unknown) => void) : null;
      const groups = onUpdate || !list.length ? [list] : list.map((t) => [t]);
      const offsets = staggerOf(to.stagger, groups.length);
      let end = base;
      const goal = expand(to);
      const start = from ? expand(from) : {};

      groups.forEach((group, i) => {
        const at = base + offsets[i];
        const item: TweenItem = {
          kind: 'tween',
          order: counter++,
          start: at,
          dur,
          repeat,
          yoyo,
          repeatDelay,
          ease,
          targets: group,
          vars: to,
          onUpdate,
          segments: [],
          handle: {}
        };
        item.handle = handleOf(item);
        items.push(item);
        end = Math.max(end, at + totalOf(dur, repeat, repeatDelay));
        for (const target of group) {
          for (const prop of Object.keys(mode === 'from' ? start : goal)) {
            const channel = channelOf(target, prop);
            const segment: Segment = {
              order: item.order,
              start: at,
              dur,
              ease,
              from: mode === 'from' || mode === 'fromTo' ? start[prop] : undefined,
              to: mode === 'from' ? undefined : goal[prop],
              lazyFrom: mode === 'to' || mode === 'set' || (mode === 'fromTo' && !(prop in start)),
              immediate,
              repeat,
              yoyo,
              repeatDelay
            };
            channel.segments.push(segment);
            item.segments.push(segment);
            if (immediate) {
              snap(channel);
              apply(channel, resolvedFrom(channel, segment), false);
            }
          }
          if (mode === 'fromTo') {
            for (const prop of Object.keys(start)) {
              if (!(prop in goal)) {
                const channel = channelOf(target, prop);
                channel.segments.push({
                  order: item.order,
                  start: at,
                  dur,
                  ease,
                  from: start[prop],
                  to: start[prop],
                  lazyFrom: false,
                  immediate,
                  repeat,
                  yoyo,
                  repeatDelay
                });
              }
            }
          }
        }
        flushTransforms(group);
      });
      track(base, end);
      return api;
    }

    function staggerOf(stagger: unknown, count: number): number[] {
      if (!stagger || count < 2) {
        return Array.from({ length: count }, () => 0);
      }
      const spec = typeof stagger === 'number' ? { each: stagger } : (stagger as { each?: number; amount?: number; from?: unknown });
      const each = spec.amount !== undefined ? spec.amount / (count - 1) : Number(spec.each ?? 0);
      const origin = spec.from;
      const pivot = origin === 'end' ? count - 1 : origin === 'center' ? (count - 1) / 2 : typeof origin === 'number' ? origin : 0;
      const distance = (i: number) => (origin === 'edges' ? Math.min(i, count - 1 - i) : Math.abs(i - pivot));
      return Array.from({ length: count }, (_, i) => round(distance(i) * each));
    }

    function snap(channel: Channel) {
      if (channel.snapped) {
        return;
      }
      channel.snapped = true;
      channel.snapshot = READ[kindOf(channel.target, channel.prop)](channel.target, channel.prop);
    }

    function before(channel: Channel, segment: Segment): Segment[] {
      return channel.segments.filter((s) => s.start < segment.start || (s.start === segment.start && s.order < segment.order));
    }

    function resolvedFrom(channel: Channel, segment: Segment): unknown {
      if (!segment.lazyFrom) {
        return segment.from;
      }
      if (!segment.resolved) {
        segment.resolved = {
          value: valueAt(channel, segment.start, before(channel, segment))
        };
      }
      return segment.resolved.value;
    }

    function resolvedTo(channel: Channel, segment: Segment): unknown {
      if (segment.to !== undefined) {
        return relative(resolvedFrom(channel, segment), segment.to);
      }
      return channel.snapshot;
    }

    function winner(segments: Segment[], t: number): { segment: Segment; p: number } | null {
      let active: Segment | null = null;
      let done: Segment | null = null;
      for (const s of segments) {
        if (s.start > t) {
          continue;
        }
        const total = totalOf(s.dur, s.repeat, s.repeatDelay);
        if (t < s.start + total) {
          if (!active || s.start > active.start || (s.start === active.start && s.order > active.order)) {
            active = s;
          }
          continue;
        }
        const end = s.start + total;
        const doneEnd = done ? done.start + totalOf(done.dur, done.repeat, done.repeatDelay) : -Infinity;
        if (!done || end > doneEnd || (end === doneEnd && (s.start > done.start || (s.start === done.start && s.order > done.order)))) {
          done = s;
        }
      }
      const s = active ?? done;
      if (!s) {
        return null;
      }
      const local = localTime(t, s);
      return { segment: s, p: s.dur ? local / s.dur : 1 };
    }

    function valueAt(channel: Channel, t: number, segments: Segment[]): unknown {
      snap(channel);
      const hit = winner(segments, t);
      if (!hit) {
        const immediate = segments.filter((s) => s.immediate).sort((a, b) => b.order - a.order)[0];
        return immediate ? resolvedFrom(channel, immediate) : channel.snapshot;
      }
      const from = resolvedFrom(channel, hit.segment);
      const to = resolvedTo(channel, hit.segment);
      const kind = kindOf(channel.target, channel.prop);
      const eased = hit.segment.ease(hit.p);
      const a = kind === Kind.Style ? convertUnit(channel.target, channel.prop, numericFor(kind, from), to) : numericFor(kind, from);
      return interpolate(a, numericFor(kind, to), hit.p >= 1 ? 1 : eased);
    }

    function midOf(channel: Channel, t: number): boolean {
      const hit = winner(channel.segments, t);
      return !!hit && hit.p > 0 && hit.p < 1;
    }

    function apply(channel: Channel, value: unknown, mid: boolean) {
      if (value === undefined) {
        return;
      }
      channel.written = true;
      WRITE[kindOf(channel.target, channel.prop)](channel.target, channel.prop, value, mid);
    }

    function flushTransforms(targets: Iterable<Target>) {
      for (const target of targets) {
        const cache = isElement(target) ? transforms.get(target) : undefined;
        if (!cache) {
          continue;
        }
        writeTransform(target as Styled, cache);
        cache.mid = 0;
      }
    }

    function render(t: number) {
      time = t;
      const touched = new Set<Target>();
      for (const channel of channels) {
        const started = channel.segments.some((s) => s.start <= t);
        if (!started && !channel.written && !channel.segments.some((s) => s.immediate)) {
          continue;
        }
        apply(channel, valueAt(channel, t, channel.segments), midOf(channel, t));
        if (kindOf(channel.target, channel.prop) === Kind.Transform) {
          touched.add(channel.target);
        }
      }
      flushTransforms(touched);
      const ordered = items.slice().sort((a, b) => a.start - b.start || a.order - b.order);
      for (const item of ordered) {
        if (item.kind === 'child') {
          item.render(clamp(0, item.dur, t - item.start));
          continue;
        }
        if (item.onUpdate) {
          item.onUpdate.call(item.handle);
        }
      }
    }

    function stop() {
      playing = false;
      if (frame) {
        win.cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    function tick(now: number) {
      frame = 0;
      if (!playing) {
        return;
      }
      const next = time + ((now - clock) / 1000) * speed;
      clock = now;
      if (next >= duration) {
        render(duration);
        stop();
        return;
      }
      render(next);
      frame = win.requestAnimationFrame(tick);
    }

    function seekTo(t: unknown) {
      render(clamp(0, duration, Number(t) || 0));
      return api;
    }

    function childEntry(child: Handle, pos: unknown) {
      const start = position(pos);
      const dur = Number((child.totalDuration as () => number)());
      child.startTime = () => start;
      child.parent = api;
      const item: ChildItem = {
        kind: 'child',
        order: counter++,
        start,
        dur,
        render: child.renderAt as (t: number) => void,
        handle: child
      };
      items.push(item);
      track(start, start + dur);
    }

    const api: Handle = {
      vars: tlVars,
      to: (targets: unknown, vars: Vars, pos?: unknown) => addTween(targets, null, vars ?? {}, pos, 'to'),
      from: (targets: unknown, vars: Vars, pos?: unknown) => addTween(targets, vars ?? {}, vars ?? {}, pos, 'from'),
      fromTo: (targets: unknown, from: Vars, to: Vars, pos?: unknown) => addTween(targets, from ?? {}, to ?? {}, pos, 'fromTo'),
      set: (targets: unknown, vars: Vars, pos?: unknown) => addTween(targets, null, { ...(vars ?? {}), duration: 0 }, pos, 'set'),
      add: (child: unknown, pos?: unknown) => {
        if (typeof child === 'string') {
          labels[child] = position(pos);
          return api;
        }
        if (child && typeof child === 'object' && typeof (child as Handle).renderAt === 'function') {
          childEntry(child as Handle, pos);
        }
        return api;
      },
      addLabel: (name: string, pos?: unknown) => {
        labels[name] = position(pos);
        return api;
      },
      call: () => api,
      tweenFromTo: (from: number, to: number, vars: Vars = {}) => {
        const span = Number(vars.duration ?? Math.abs(to - from));
        const remap: Handle = {
          vars,
          renderAt: (local: number) => (api.renderAt as (t: number) => void)(from + (to - from) * (span ? clamp(0, 1, local / span) : 1)),
          totalDuration: () => span,
          duration: () => span,
          startTime: () => 0,
          targets: () => [api],
          pause: () => remap,
          paused: () => true
        };
        return remap;
      },
      renderAt: (t: number) => render(t),
      render: (t: number) => render(Number(t) || 0),
      totalTime: (t?: unknown) => (t === undefined ? time : seekTo(t)),
      time: (t?: unknown) => (t === undefined ? time : seekTo(t)),
      seek: (t?: unknown) => (t === undefined ? time : seekTo(typeof t === 'string' ? (labels[t] ?? 0) : t)),
      progress: (p?: unknown) => (p === undefined ? (duration ? time / duration : 0) : seekTo(Number(p) * duration)),
      totalProgress: (p?: unknown) => (api.progress as (p?: unknown) => unknown)(p),
      duration: () => duration,
      totalDuration: () => duration,
      startTime: () => 0,
      getChildren: (nested = true, tweens = true, timelines = true): Handle[] =>
        items.flatMap((item) => {
          const h = item.handle;
          const children = h.getChildren as ((n: boolean, t: boolean, l: boolean) => Handle[]) | undefined;
          const own = children ? timelines : tweens;
          return [...(own ? [h] : []), ...(nested && children ? children(true, tweens, timelines) : [])];
        }),
      paused: (value?: unknown) => {
        if (value === undefined) {
          return !playing;
        }
        if (value) {
          stop();
        }
        return api;
      },
      pause: () => {
        stop();
        return api;
      },
      play: () => {
        if (playing) {
          return api;
        }
        if (time >= duration) {
          render(0);
        }
        playing = true;
        clock = win.performance ? win.performance.now() : 0;
        frame = win.requestAnimationFrame(tick);
        return api;
      },
      resume: () => (api.play as () => Handle)(),
      timeScale: (value?: unknown) => {
        if (value === undefined) {
          return speed;
        }
        speed = Number(value) || 1;
        return api;
      },
      isActive: () => playing,
      eventCallback: () => api,
      invalidate: () => api,
      kill: () => {
        stop();
        return api;
      },
      revert: () => {
        stop();
        return api;
      },
      clear: () => {
        items.length = 0;
        channels.length = 0;
        byTarget.clear();
        duration = 0;
        return api;
      }
    };
    return api;
  }

  function set(targets: unknown, vars: Vars) {
    const once = timeline();
    (once.set as (t: unknown, v: Vars, p: number) => void)(targets, vars, 0);
    (once.render as (t: number) => void)(0);
  }

  function split(target: unknown, vars: Vars = {}) {
    const type = String(vars.type ?? 'chars,words,lines');
    const wants = (unit: string) => type.includes(unit);
    const roots = resolveTargets(target).filter(isElement) as unknown as HTMLElement[];
    const result = {
      chars: [] as HTMLElement[],
      words: [] as HTMLElement[],
      lines: [] as HTMLElement[],
      revert: () => {}
    };
    const originals = roots.map((el) => el.innerHTML);
    const box = (cls: unknown) => {
      const el = doc.createElement('div');
      el.style.position = 'relative';
      el.style.display = 'inline-block';
      if (cls) {
        el.className = String(cls);
      }
      return el;
    };

    for (const el of roots) {
      const text = el.textContent ?? '';
      el.textContent = '';
      const words: HTMLElement[] = [];
      const pieces = text.split(/(\s+)/);
      for (const piece of pieces) {
        if (!piece) {
          continue;
        }
        if (/^\s+$/.test(piece)) {
          el.appendChild(doc.createTextNode(piece));
          continue;
        }
        const word = box(vars.wordsClass);
        if (wants('chars')) {
          for (const ch of [...piece]) {
            const c = box(vars.charsClass);
            c.textContent = ch;
            word.appendChild(c);
            result.chars.push(c);
          }
        } else {
          word.textContent = piece;
        }
        el.appendChild(word);
        words.push(word);
      }
      if (wants('lines')) {
        const rows: HTMLElement[][] = [];
        let top = Number.NaN;
        for (const w of words) {
          if (w.offsetTop !== top || !rows.length) {
            if (rows.length && Math.abs(w.offsetTop - top) < 1) {
              rows[rows.length - 1].push(w);
              continue;
            }
            rows.push([]);
            top = w.offsetTop;
          }
          rows[rows.length - 1].push(w);
        }
        el.textContent = '';
        for (const row of rows) {
          const line = doc.createElement('div');
          line.style.display = 'block';
          line.style.textAlign = 'start';
          line.style.position = 'relative';
          if (vars.linesClass) {
            line.className = String(vars.linesClass);
          }
          row.forEach((w, i) => {
            if (i) {
              line.appendChild(doc.createTextNode(' '));
            }
            line.appendChild(wants('words') || wants('chars') ? w : doc.createTextNode(w.textContent ?? ''));
          });
          el.appendChild(line);
          result.lines.push(line);
        }
      }
      if (wants('words')) {
        result.words.push(...words);
      }
    }
    result.revert = () => roots.forEach((el, i) => (el.innerHTML = originals[i]));
    return result;
  }

  function SplitText(this: unknown, target: unknown, vars?: Vars) {
    return split(target, vars);
  }

  type Shape = SVGElement & { getTotalLength: () => number; getPointAtLength: (at: number) => { x: number; y: number } };
  type Point = [number, number];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MORPH_POINTS = 96;
  const SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const SCRAMBLES_PER_CHAR = 3;

  const first = <T>(target: unknown) => resolveTargets(target)[0] as T;
  const rounded = (v: number) => Math.round(v * 100) / 100;

  function driver<K extends string>(keys: Record<K, number>, paint: (values: Record<K, number>) => void) {
    const values = { ...keys };
    const handle = {} as Record<K, number>;
    for (const key of Object.keys(keys) as K[]) {
      Object.defineProperty(handle, key, {
        enumerable: true,
        get: () => values[key],
        set: (v: number) => {
          values[key] = v;
          paint(values);
        }
      });
    }
    paint(values);
    return handle;
  }

  function drawPath(target: unknown) {
    const path = first<SVGElement>(target);
    path.setAttribute('pathLength', '1');
    return driver({ start: 0, draw: 0 }, ({ start, draw }) => {
      path.style.setProperty('stroke-dasharray', `${Math.max(0, draw - start)} 2`);
      path.style.setProperty('stroke-dashoffset', String(-start));
    });
  }

  function sampled(host: Node, d: string, count: number, closed: boolean): Point[] {
    const probe = doc.createElementNS(SVG_NS, 'path') as Shape;
    probe.setAttribute('d', d);
    host.appendChild(probe);
    const length = probe.getTotalLength();
    const span = closed ? count : count - 1;
    const points = Array.from({ length: count }, (_, i): Point => {
      const at = probe.getPointAtLength((length * i) / span);
      return [at.x, at.y];
    });
    probe.remove();
    return points;
  }

  function aligned(from: Point[], to: Point[]): Point[] {
    const cost = (candidate: Point[], shift: number) => from.reduce((sum, p, i) => {
      const q = candidate[(i + shift) % candidate.length];
      return sum + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }, 0);
    let best = { points: to, shift: 0, cost: Infinity };
    for (const candidate of [to, [...to].reverse()]) {
      for (let shift = 0; shift < candidate.length; shift++) {
        const c = cost(candidate, shift);
        if (c < best.cost) {
          best = { points: candidate, shift, cost: c };
        }
      }
    }
    return from.map((_, i) => best.points[(i + best.shift) % best.points.length]);
  }

  function morph(target: unknown, to: string, vars: { points?: number } = {}) {
    const path = first<SVGElement>(target);
    const fromD = path.getAttribute('d') ?? '';
    const closed = /z\s*$/i.test(fromD) && /z\s*$/i.test(to);
    const count = vars.points ?? MORPH_POINTS;
    const host = path.parentNode ?? doc.body;
    const from = sampled(host, fromD, count, closed);
    const goal = sampled(host, to, count, closed);
    const end = closed ? aligned(from, goal) : goal;
    return driver({ morph: 0 }, ({ morph: p }) => {
      const points = from.map(([x, y], i) => `${rounded(x + (end[i][0] - x) * p)},${rounded(y + (end[i][1] - y) * p)}`);
      path.setAttribute('d', `M${points.join('L')}${closed ? 'Z' : ''}`);
    });
  }

  function noise(seed: number, i: number, step: number): number {
    let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(step + 1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function scramble(target: unknown, text: string, vars: { seed?: number; chars?: string } = {}) {
    const el = first<HTMLElement>(target);
    const glyphs = [...text];
    const chars = [...(vars.chars ?? SCRAMBLE_CHARS)];
    const seed = vars.seed ?? 0;
    return driver({ reveal: 0 }, ({ reveal }) => {
      const shown = reveal >= 1 ? glyphs.length : Math.floor(reveal * glyphs.length);
      const step = Math.floor(reveal * glyphs.length * SCRAMBLES_PER_CHAR);
      el.textContent = glyphs.map((g, i) => (i < shown || /\s/.test(g) ? g : chars[noise(seed, i, step) % chars.length])).join('');
    });
  }

  function flip(targets: unknown, change: () => void) {
    const els = resolveTargets(targets) as unknown as HTMLElement[];
    const box = (el: HTMLElement) => el.getBoundingClientRect();
    const before = els.map(box);
    change();
    const after = els.map(box);
    const ratio = (a: number, b: number) => (b ? a / b : 1);
    return driver({ flip: 0 }, ({ flip: p }) => {
      const q = 1 - p;
      els.forEach((el, i) => {
        const [a, b] = [before[i], after[i]];
        const sx = rounded(1 + (ratio(a.width, b.width) - 1) * q);
        const sy = rounded(1 + (ratio(a.height, b.height) - 1) * q);
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate(${rounded((a.left - b.left) * q)}px, ${rounded((a.top - b.top) * q)}px) scale(${sx}, ${sy})`;
      });
    });
  }

  return {
    drawPath,
    morph,
    scramble,
    flip,
    timeline,
    set,
    parseEase,
    registerEase: (name, fn) => {
      custom[name] = fn;
    },
    utils: {
      interpolate,
      clamp,
      mapRange: (a, b, c, d, v) => c + ((v - a) / (b - a)) * (d - c),
      toArray: (t) => resolveTargets(t)
    },
    split,
    SplitText
  };
}

export function engineScript(): string {
  return `window.${ENGINE_GLOBAL}=(${motionEngine.toString()})(window);`;
}
