export type Ease = (t: number) => number;
export type StaggerFrom = 'start' | 'end' | 'center' | 'edges' | 'random' | number;
export type StaggerVars = { each?: number; amount?: number; from?: StaggerFrom; ease?: string };
export type TweenVars = {
  duration?: number;
  delay?: number;
  ease?: string | Ease;
  stagger?: number | StaggerVars;
  repeat?: number;
  repeatDelay?: number;
  yoyo?: boolean;
  immediateRender?: boolean;
  onUpdate?: (progress: number) => void;
  [prop: string]: unknown;
};
export type Position = number | string | undefined;
export type Target = Element | object | ArrayLike<Element | object> | null | undefined;

export function hfKit() {
  const TAU = Math.PI * 2;
  const TINY = 1e-8;
  const DEFAULT_DURATION = 0.5;
  const FOREVER = 1e6;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const fromOut = (out: Ease): Ease => (p) => (p < 0.5 ? (1 - out(1 - p * 2)) / 2 : 0.5 + out((p - 0.5) * 2) / 2);
  const fromIn = (inn: Ease): Ease => (p) => 1 - inn(1 - p);

  const power = (n: number) => {
    const inn: Ease = (p) => Math.pow(p, n);
    const out = fromIn(inn);
    return { in: inn, out, inOut: fromOut(out) };
  };

  const sineIn: Ease = (p) => 1 - Math.cos((p * Math.PI) / 2);
  const sineOut: Ease = (p) => Math.sin((p * Math.PI) / 2);
  const expoIn: Ease = (p) => (p ? Math.pow(2, 10 * (p - 1)) : 0);
  const circIn: Ease = (p) => -(Math.sqrt(1 - p * p) - 1);

  const back = (overshoot = 1.70158) => {
    const inn: Ease = (p) => (p ? p * p * ((overshoot + 1) * p - overshoot) : 0);
    const out: Ease = (p) => (p - 1) * (p - 1) * ((overshoot + 1) * (p - 1) + overshoot) + 1;
    return { in: inn, out, inOut: fromOut(out) };
  };

  const elastic = (kind: 'in' | 'out' | 'inOut', amplitude = 1, period?: number): Ease => {
    const p1 = amplitude >= 1 ? amplitude : 1;
    const fallback = kind === 'inOut' ? 0.45 : 0.3;
    const p2 = (period || fallback) / (amplitude < 1 ? amplitude : 1);
    const p3 = (p2 / TAU) * (Math.asin(1 / p1) || 0);
    const k = TAU / p2;
    const out: Ease = (p) => (p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * Math.sin((p - p3) * k) + 1);
    if (kind === 'out') {
      return out;
    }
    return kind === 'in' ? fromIn(out) : fromOut(out);
  };

  const bounceOut: Ease = (p) => {
    const n = 7.5625;
    const d = 2.75;
    if (p < 1 / d) {
      return n * p * p;
    }
    if (p < 2 / d) {
      p -= 1.5 / d;
      return n * p * p + 0.75;
    }
    if (p < 2.5 / d) {
      p -= 2.25 / d;
      return n * p * p + 0.9375;
    }
    p -= 2.625 / d;
    return n * p * p + 0.984375;
  };

  const steps = (count: number): Ease => {
    const max = 1 - TINY;
    return (p) => ((((count + 1) * clamp(p, 0, max)) | 0) * 1) / count;
  };

  const POWER_NAMES: Record<string, number> = { power0: 1, linear: 1, power1: 2, quad: 2, power2: 3, cubic: 3, power3: 4, quart: 4, strong: 5, power4: 5, quint: 5 };

  const pickKind = (set: { in: Ease; out: Ease; inOut: Ease }, kind: string) => set[(kind || 'out') as 'in' | 'out' | 'inOut'] ?? set.out;

  const ease = (spec: string | Ease | undefined): Ease => {
    if (typeof spec === 'function') {
      return spec;
    }
    const text = String(spec ?? 'power1.out').replace(/\s+/g, '');
    if (text === 'none') {
      return (p) => p;
    }
    const match = /^([a-z0-9]+)(?:\.([a-zA-Z]+))?(?:\(([^)]*)\))?$/.exec(text);
    if (!match) {
      return (p) => p;
    }
    const name = match[1];
    const kind = match[2] || '';
    const args = match[3] ? match[3].split(',').map(Number) : [];
    if (name === 'power0' || name === 'linear') {
      return (p) => p;
    }
    if (name in POWER_NAMES) {
      return pickKind(power(POWER_NAMES[name]), kind);
    }
    if (name === 'sine') {
      return pickKind({ in: sineIn, out: sineOut, inOut: (p) => -0.5 * (Math.cos(Math.PI * p) - 1) }, kind);
    }
    if (name === 'expo') {
      const out = fromIn(expoIn);
      return pickKind({ in: expoIn, out, inOut: fromOut(out) }, kind);
    }
    if (name === 'circ') {
      const out = fromIn(circIn);
      return pickKind({ in: circIn, out, inOut: fromOut(out) }, kind);
    }
    if (name === 'back') {
      return pickKind(back(args[0]), kind);
    }
    if (name === 'elastic') {
      return elastic((kind || 'out') as 'in' | 'out' | 'inOut', args[0], args[1]);
    }
    if (name === 'bounce') {
      return pickKind({ in: fromIn(bounceOut), out: bounceOut, inOut: fromOut(bounceOut) }, kind);
    }
    if (name === 'steps') {
      return steps(args[0] || 1);
    }
    return (p) => p;
  };

  const TRANSFORMS = new Set(['x', 'y', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotate', 'skewX', 'skewY']);
  const TRANSFORM_BASE: Record<string, number> = { x: 0, y: 0, xPercent: 0, yPercent: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 };
  const UNITLESS = new Set(['opacity', 'zIndex', 'flexGrow', 'flexShrink', 'order', 'fontWeight', 'lineHeight', 'strokeOpacity', 'fillOpacity', 'strokeMiterlimit', 'scale', 'flex']);
  const RESERVED = new Set(['duration', 'delay', 'ease', 'stagger', 'repeat', 'repeatDelay', 'yoyo', 'immediateRender', 'onUpdate', 'overwrite', 'css', 'paused', 'onComplete', 'onStart', 'data']);
  const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  const HEX = /^#([0-9a-f]{3,8})$/i;
  const RGB = /^rgba?\(\s*([^)]+)\)$/i;

  const kebab = (s: string) => (s.startsWith('--') ? s : s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

  const parseRgb = (v: string): number[] | null => {
    const text = v.trim();
    if (text === 'transparent') {
      return [0, 0, 0, 0];
    }
    const hex = HEX.exec(text);
    if (hex) {
      let h = hex[1];
      if (h.length <= 4) {
        h = h.split('').map((c) => c + c).join('');
      }
      const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      return [...n, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    const rgb = RGB.exec(text);
    if (!rgb) {
      return null;
    }
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  };

  const round = (n: number) => Math.round(n * 10000) / 10000;

  const mix = (a: unknown, b: unknown, p: number): unknown => {
    if (typeof a === 'number' && typeof b === 'number') {
      return a + (b - a) * p;
    }
    const sa = String(a);
    const sb = String(b);
    const ca = parseRgb(sa);
    const cb = parseRgb(sb);
    if (ca && cb) {
      const [r, g, bl] = [0, 1, 2].map((i) => clamp(Math.round(ca[i] + (cb[i] - ca[i]) * p), 0, 255));
      return `rgba(${r}, ${g}, ${bl}, ${round(clamp(ca[3] + (cb[3] - ca[3]) * p, 0, 1))})`;
    }
    const na = sa.match(NUMBER);
    const nb = sb.match(NUMBER);
    if (!na || !nb || na.length !== nb.length) {
      return p < 1 ? a : b;
    }
    let i = 0;
    return sb.replace(NUMBER, () => {
      const v = round(Number(na[i]) + (Number(nb[i]) - Number(na[i])) * p);
      i++;
      return String(v);
    });
  };

  const unit = (prop: string, v: unknown, styled: boolean): unknown => (styled && typeof v === 'number' && !UNITLESS.has(prop) && !TRANSFORMS.has(prop) ? `${v}px` : v);

  type Seg = { start: number; end: number; from: unknown; to: unknown; ease: Ease; hold: boolean; repeat: number; gap: number; yoyo: boolean; step: boolean };
  type Entry = { target: Element | Record<string, unknown>; base: Map<string, unknown>; segs: Map<string, Seg[]>; updates: ((p: number) => void)[] };

  const segValue = (s: Seg, t: number): unknown => {
    if (s.step) {
      return s.to;
    }
    const len = s.end - s.start;
    const span = len + s.gap;
    const local = t - s.start;
    const cycle = len > 0 && s.repeat !== 0 ? Math.min(Math.floor(local / span), s.repeat < 0 ? FOREVER : s.repeat) : 0;
    const within = len > 0 ? local - cycle * span : 0;
    const done = len <= 0 || (s.repeat >= 0 && cycle >= s.repeat && within >= len);
    if (done && !(s.repeat !== 0 && s.yoyo && cycle % 2 === 1)) {
      return s.to;
    }
    let p = len > 0 ? clamp(within / len, 0, 1) : 1;
    if (s.yoyo && cycle % 2 === 1) {
      p = 1 - p;
    }
    return mix(s.from, s.to, s.ease(p));
  };

  const valueAt = (entry: Entry, prop: string, t: number, limit = Infinity): unknown => {
    const list = entry.segs.get(prop) ?? [];
    let value = entry.base.get(prop);
    for (let i = 0; i < list.length && i < limit; i++) {
      const s = list[i];
      if (t < s.start) {
        if (s.hold && i === 0) {
          value = s.from;
        }
        continue;
      }
      value = segValue(s, t);
    }
    return value;
  };

  const SETTLE_AT = 1e-9;

  const baseOf = (el: Element | Record<string, unknown>, prop: string): unknown => {
    if (prop in TRANSFORM_BASE) {
      return TRANSFORM_BASE[prop];
    }
    if (!(el instanceof Element)) {
      return el[prop];
    }
    const style = (el as HTMLElement).style;
    const name = kebab(prop);
    const inline = style.getPropertyValue(name);
    if (inline) {
      return name === 'opacity' ? Number(inline) : inline;
    }
    const computed = getComputedStyle(el).getPropertyValue(name);
    if (name === 'opacity') {
      return computed === '' ? 1 : Number(computed);
    }
    return computed === '' ? (name === 'visibility' ? 'visible' : 0) : computed;
  };

  const expand = (vars: Record<string, unknown>): Record<string, unknown> => {
    const flat: Record<string, unknown> = {};
    const source = { ...(vars.css as Record<string, unknown> | undefined), ...vars };
    for (const [key, raw] of Object.entries(source)) {
      if (RESERVED.has(key) || raw === undefined) {
        continue;
      }
      if (key === 'scale') {
        flat.scaleX = raw;
        flat.scaleY = raw;
        continue;
      }
      if (key === 'rotate') {
        flat.rotation = raw;
        continue;
      }
      if (key === 'autoAlpha') {
        flat.opacity = raw;
        flat.__auto = true;
        continue;
      }
      if ((key === 'x' || key === 'y') && typeof raw === 'string' && raw.endsWith('%')) {
        flat[`${key}Percent`] = parseFloat(raw);
        continue;
      }
      flat[key] = raw;
    }
    return flat;
  };

  const resolveRelative = (prev: unknown, raw: unknown): unknown => {
    if (typeof raw !== 'string' || !/^[+-]=/.test(raw) || typeof prev !== 'number') {
      return raw;
    }
    return prev + (raw[0] === '-' ? -1 : 1) * parseFloat(raw.slice(2));
  };

  const stagger = (n: number, spec: number | StaggerVars | undefined): number[] => {
    if (spec === undefined || spec === 0) {
      return Array.from({ length: n }, () => 0);
    }
    const o: StaggerVars = typeof spec === 'number' ? { each: spec } : spec;
    const from = o.from ?? 'start';
    const centre = (n - 1) / 2;
    const rank = (i: number) => {
      if (from === 'end') {
        return n - 1 - i;
      }
      if (from === 'center') {
        return Math.abs(i - centre);
      }
      if (from === 'edges') {
        return Math.min(i, n - 1 - i);
      }
      if (from === 'random') {
        return ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1 * (n - 1);
      }
      if (typeof from === 'number') {
        return Math.abs(i - from);
      }
      return i;
    };
    const ranks = Array.from({ length: n }, (_, i) => rank(i));
    const top = Math.max(...ranks, 0);
    const shape = o.ease ? ease(o.ease) : (p: number) => p;
    if (o.amount !== undefined) {
      return ranks.map((r) => (top ? shape(r / top) * o.amount! : 0));
    }
    const each = o.each ?? 0;
    return ranks.map((r) => (o.ease && top ? shape(r / top) * top * each : r * each));
  };

  const listOf = (target: Target): (Element | Record<string, unknown>)[] => {
    if (!target) {
      return [];
    }
    if (target instanceof Element) {
      return [target];
    }
    if (Array.isArray(target) || (typeof (target as ArrayLike<unknown>).length === 'number' && !(target instanceof Element))) {
      return Array.from(target as ArrayLike<Element>);
    }
    return [target as Record<string, unknown>];
  };

  const timeline = () => {
    const entries = new Map<Element | Record<string, unknown>, Entry>();
    const labels = new Map<string, number>();
    const calls: { at: number; fn: (past: boolean, t: number) => void }[] = [];
    let cursor = 0;
    let lastStart = 0;
    let lastEnd = 0;

    const entryOf = (target: Element | Record<string, unknown>) => {
      let entry = entries.get(target);
      if (!entry) {
        entry = { target, base: new Map(), segs: new Map(), updates: [] };
        entries.set(target, entry);
      }
      return entry;
    };

    const place = (at: Position): number => {
      if (typeof at === 'number') {
        return at;
      }
      if (at === undefined) {
        return cursor;
      }
      const text = String(at).trim();
      const rel = /^([<>]|[a-zA-Z_][\w-]*)?\s*([+-]=)?\s*(-?[\d.]+)?$/.exec(text);
      if (!rel) {
        return cursor;
      }
      const [, anchorText, op, num] = rel;
      let anchor = cursor;
      if (anchorText === '<') {
        anchor = lastStart;
      } else if (anchorText === '>') {
        anchor = lastEnd;
      } else if (anchorText) {
        anchor = labels.get(anchorText) ?? cursor;
      }
      const offset = num === undefined ? 0 : Number(num);
      if (op === '-=') {
        return anchor - offset;
      }
      if (op === '+=' || (anchorText && num !== undefined)) {
        return anchor + offset;
      }
      return anchor;
    };

    const add = (kind: 'to' | 'from' | 'fromTo' | 'set', target: Target, a: TweenVars, b: TweenVars | Position, c?: Position) => {
      const from = kind === 'fromTo' ? (a as Record<string, unknown>) : null;
      const vars = (kind === 'fromTo' ? b : a) as TweenVars;
      const at = kind === 'fromTo' ? c : (b as Position);
      const items = listOf(target);
      const offsets = stagger(items.length, vars.stagger);
      const base = place(at) + (vars.delay ?? 0);
      const duration = kind === 'set' ? 0 : vars.duration ?? DEFAULT_DURATION;
      const to = expand(vars);
      const start0 = expand(from ?? {});
      const repeat = vars.repeat ?? 0;
      const gap = vars.repeatDelay ?? 0;
      const easing = ease(vars.ease);
      let tweenEnd = base;

      items.forEach((item, i) => {
        const entry = entryOf(item);
        const start = base + offsets[i];
        const end = start + duration;
        tweenEnd = Math.max(tweenEnd, repeat < 0 ? start + duration : start + duration * (repeat + 1) + gap * Math.max(repeat, 0));
        const props = kind === 'from' ? Object.keys(to) : Object.keys({ ...start0, ...to });

        for (const prop of props) {
          if (prop === '__auto') {
            continue;
          }
          if (!entry.base.has(prop)) {
            entry.base.set(prop, baseOf(item, prop));
          }
          const list = entry.segs.get(prop) ?? [];
          const prev = valueAt(entry, prop, start + SETTLE_AT);
          let fromValue: unknown;
          let toValue: unknown;
          if (kind === 'from') {
            fromValue = to[prop];
            toValue = prev;
          } else if (kind === 'fromTo') {
            fromValue = start0[prop] ?? prev;
            toValue = to[prop] ?? prev;
          } else {
            fromValue = prev;
            toValue = to[prop];
          }
          const styled = item instanceof Element;
          fromValue = unit(prop, resolveRelative(prev, fromValue), styled);
          toValue = unit(prop, resolveRelative(prev, toValue), styled);
          const hold = (kind === 'from' || kind === 'fromTo') && vars.immediateRender !== false;
          list.push({ start, end, from: fromValue, to: toValue, ease: easing, hold, repeat, gap, yoyo: Boolean(vars.yoyo), step: kind === 'set' });
          list.sort((x, y) => x.start - y.start);
          entry.segs.set(prop, list);
        }

        if (to.__auto) {
          entry.segs.set('__auto', [{ start, end, from: 1, to: 1, ease: easing, hold: false, repeat: 0, gap: 0, yoyo: false, step: true }]);
        }
        if (vars.onUpdate) {
          entry.updates.push(vars.onUpdate as (p: number) => void);
        }
      });

      lastStart = base;
      lastEnd = tweenEnd;
      cursor = Math.max(cursor, tweenEnd);
      return api;
    };

    const apply = (entry: Entry, t: number) => {
      const target = entry.target;
      const transform: Record<string, number> = { ...TRANSFORM_BASE };
      let moved = false;
      for (const prop of entry.segs.keys()) {
        if (prop === '__auto') {
          continue;
        }
        const value = valueAt(entry, prop, t);
        if (prop in TRANSFORM_BASE) {
          transform[prop] = Number(value);
          moved = true;
          continue;
        }
        if (!(target instanceof Element)) {
          target[prop] = value;
          continue;
        }
        const style = (target as HTMLElement).style;
        style.setProperty(kebab(prop), String(value));
        if (entry.segs.has('__auto') && prop === 'opacity') {
          style.visibility = Number(value) <= 0 ? 'hidden' : 'inherit';
        }
      }
      if (moved && target instanceof Element) {
        const o = transform;
        (target as HTMLElement).style.transform = `translate(${round(o.x)}px, ${round(o.y)}px) translate(${round(o.xPercent)}%, ${round(o.yPercent)}%) rotate(${round(o.rotation)}deg) skewX(${round(o.skewX)}deg) skewY(${round(o.skewY)}deg) scale(${round(o.scaleX)}, ${round(o.scaleY)})`;
      }
    };

    const api = {
      to: (target: Target, vars: TweenVars, at?: Position) => add('to', target, vars, at),
      from: (target: Target, vars: TweenVars, at?: Position) => add('from', target, vars, at),
      fromTo: (target: Target, from: TweenVars, to: TweenVars, at?: Position) => add('fromTo', target, from, to, at),
      set: (target: Target, vars: TweenVars, at?: Position) => add('set', target, vars, at),
      addLabel: (name: string, at?: Position) => {
        labels.set(name, place(at));
        return api;
      },
      call: (fn: (past: boolean, t: number) => void, at?: Position) => {
        calls.push({ at: place(at), fn });
        return api;
      },
      duration: () => cursor,
      render: (t: number) => {
        entries.forEach((entry) => {
          apply(entry, t);
          entry.updates.forEach((u) => u(clamp(t, 0, cursor)));
        });
        calls.forEach((c) => c.fn(t >= c.at, t));
      }
    };
    return api;
  };

  return { ease, timeline, gsapClamp: clamp };
}

export type HfKit = ReturnType<typeof hfKit>;
