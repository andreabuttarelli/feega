export type Extrapolate = 'clamp' | 'extend' | 'identity';
export type Ease = (t: number) => number;
export type InterpolateOptions = { easing?: Ease; extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate };
export type SpringConfig = { damping?: number; mass?: number; stiffness?: number; overshootClamping?: boolean };
export type SpringInput = { frame: number; fps: number; config?: SpringConfig; from?: number; to?: number; durationInFrames?: number; durationRestThreshold?: number; delay?: number; reverse?: boolean };
export type Rgba = { r: number; g: number; b: number; alpha: number };
export type Style = Record<string, string | number | null | undefined | false>;
export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = { style?: Style; [key: string]: unknown };
export type Theme = Record<string, string | number | undefined> & { radius: number; fontFamily?: string };
export type Step = { at: number; state: string; duration?: number };

export function snapcnKit() {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const edge = (value: number, lo: number, hi: number, out0: number, out1: number, mode: Extrapolate, side: 'left' | 'right') => {
    if (mode === 'identity') {
      return value;
    }
    if (mode === 'clamp') {
      return side === 'left' ? (value < lo ? out0 : null) : value > hi ? out1 : null;
    }
    return null;
  };

  const segment = (input: number, inMin: number, inMax: number, outMin: number, outMax: number, o: InterpolateOptions) => {
    const left = edge(input, inMin, inMax, outMin, outMax, o.extrapolateLeft ?? 'extend', 'left');
    if (input < inMin && left !== null) {
      return left;
    }
    const right = edge(input, inMin, inMax, outMin, outMax, o.extrapolateRight ?? 'extend', 'right');
    if (input > inMax && right !== null) {
      return right;
    }
    if (outMin === outMax) {
      return outMin;
    }
    let p = inMin === inMax ? (input <= inMin ? 0 : 1) : (input - inMin) / (inMax - inMin);
    p = (o.easing ?? ((t: number) => t))(p);
    return outMin + p * (outMax - outMin);
  };

  const interpolate = (input: number, inRange: readonly number[], outRange: readonly number[], o: InterpolateOptions = {}) => {
    let i = 1;
    while (i < inRange.length - 1 && inRange[i] < input) {
      i++;
    }
    return segment(input, inRange[i - 1], inRange[i], outRange[i - 1], outRange[i], o);
  };

  const springAt = (seconds: number, config: SpringConfig) => {
    const c = config.damping ?? 10;
    const m = config.mass ?? 1;
    const k = config.stiffness ?? 100;
    const zeta = c / (2 * Math.sqrt(k * m));
    const w0 = Math.sqrt(k / m);
    const t = Math.max(0, seconds);
    if (zeta < 1) {
      const w1 = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.sin(w1 * t) * ((zeta * w0) / w1) + Math.cos(w1 * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };

  const settled = new Map<string, number>();

  const measureSpring = ({ fps, config = {}, threshold = 0.005 }: { fps: number; config?: SpringConfig; threshold?: number }) => {
    const key = [fps, config.damping, config.mass, config.stiffness, threshold].join('-');
    const known = settled.get(key);
    if (known !== undefined) {
      return known;
    }
    const off = (f: number) => Math.abs(springAt(f / fps, config) - 1);
    let frame = 0;
    while (off(frame) >= threshold) {
      frame++;
    }
    let finished = frame;
    for (let i = 0; i < 20; i++) {
      frame++;
      if (off(frame) >= threshold) {
        i = 0;
        finished = frame + 1;
      }
    }
    settled.set(key, finished);
    return finished;
  };

  const spring = ({ frame, fps, config = {}, from = 0, to = 1, durationInFrames, durationRestThreshold, delay = 0, reverse = false }: SpringInput) => {
    const natural = reverse || durationInFrames !== undefined ? measureSpring({ fps, config, threshold: durationRestThreshold }) : 0;
    const turned = reverse ? (durationInFrames ?? natural) - frame : frame;
    const delayed = turned + (reverse ? delay : -delay);
    if (durationInFrames && delayed > durationInFrames) {
      return to;
    }
    const stretched = durationInFrames === undefined ? delayed : delayed / (durationInFrames / natural);
    const raw = springAt(Math.max(0, stretched) / fps, config);
    const inner = config.overshootClamping ? Math.min(raw, 1) : raw;
    return from === 0 && to === 1 ? inner : interpolate(inner, [0, 1], [from, to]);
  };

  const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
    if (x1 === y1 && x2 === y2) {
      return (t) => t;
    }
    const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
    const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
    const cc = (p1: number) => 3 * p1;
    const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + cc(p1)) * t;
    const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + cc(p1);
    const SAMPLES = 11;
    const STEP = 1 / (SAMPLES - 1);
    const table = Array.from({ length: SAMPLES }, (_, i) => at(i * STEP, x1, x2));
    const tOf = (x: number) => {
      let start = 0;
      let i = 1;
      for (; i !== SAMPLES - 1 && table[i] <= x; i++) {
        start += STEP;
      }
      i--;
      let guess = start + ((x - table[i]) / (table[i + 1] - table[i])) * STEP;
      const s = slope(guess, x1, x2);
      if (s >= 0.001) {
        for (let n = 0; n < 4; n++) {
          const d = slope(guess, x1, x2);
          if (d === 0) {
            break;
          }
          guess -= (at(guess, x1, x2) - x) / d;
        }
        return guess;
      }
      if (s === 0) {
        return guess;
      }
      let lo = start;
      let hi = start + STEP;
      let n = 0;
      let mid = 0;
      let diff = 0;
      do {
        mid = lo + (hi - lo) / 2;
        diff = at(mid, x1, x2) - x;
        if (diff > 0) {
          hi = mid;
        } else {
          lo = mid;
        }
      } while (Math.abs(diff) > 0.0000001 && ++n < 10);
      return mid;
    };
    return (x) => (x === 0 || x === 1 ? x : at(tOf(x), y1, y2));
  };

  const Easing = {
    linear: (t: number) => t,
    ease: bezier(0.42, 0, 1, 1),
    quad: (t: number) => t * t,
    cubic: (t: number) => t * t * t,
    poly: (n: number) => (t: number) => Math.pow(t, n),
    sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
    circle: (t: number) => 1 - Math.sqrt(1 - t * t),
    exp: (t: number) => Math.pow(2, 10 * (t - 1)),
    elastic: (bounciness = 1) => {
      const p = bounciness * Math.PI;
      return (t: number) => 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * p);
    },
    back: (s = 1.70158) => (t: number) => t * t * ((s + 1) * t - s),
    bounce: (t: number) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      }
      if (t < 2 / 2.75) {
        const u = t - 1.5 / 2.75;
        return 7.5625 * u * u + 0.75;
      }
      if (t < 2.5 / 2.75) {
        const u = t - 2.25 / 2.75;
        return 7.5625 * u * u + 0.9375;
      }
      const u = t - 2.625 / 2.75;
      return 7.5625 * u * u + 0.984375;
    },
    bezier,
    in: (e: Ease) => e,
    out: (e: Ease) => (t: number) => 1 - e(1 - t),
    inOut: (e: Ease) => (t: number) => (t < 0.5 ? e(t * 2) / 2 : 1 - e((1 - t) * 2) / 2)
  };

  const mulberry = (a: number) => {
    let t = a + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hashOf = (s: string) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  const random = (seed: string | number) => (typeof seed === 'string' ? mulberry(hashOf(seed)) : mulberry(seed * 10000000000));

  const BLACK: Rgba = { r: 0, g: 0, b: 0, alpha: 1 };
  const parsed = new Map<string, Rgba>();
  let probe: CanvasRenderingContext2D | null = null;

  const parseColor = (input: string): Rgba => {
    const s = String(input).trim();
    const known = parsed.get(s);
    if (known) {
      return { ...known };
    }
    probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!probe || s.startsWith('var(')) {
      return { ...BLACK };
    }
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = s;
    const normal = String(probe.fillStyle);
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normal);
    const rgba = /^rgba?\(([^)]+)\)$/.exec(normal);
    const out: Rgba = hex
      ? { r: parseInt(hex[1], 16) / 255, g: parseInt(hex[2], 16) / 255, b: parseInt(hex[3], 16) / 255, alpha: 1 }
      : rgba
        ? (() => {
            const [r, g, b, a] = rgba[1].split(',').map((v) => parseFloat(v));
            return { r: r / 255, g: g / 255, b: b / 255, alpha: a ?? 1 };
          })()
        : { ...BLACK };
    parsed.set(s, out);
    return { ...out };
  };

  const channel = (v: number) => Math.round(clamp(v, 0, 1) * 255);

  const toCss = (c: Rgba) => (c.alpha >= 1 ? `rgb(${channel(c.r)}, ${channel(c.g)}, ${channel(c.b)})` : `rgba(${channel(c.r)}, ${channel(c.g)}, ${channel(c.b)}, ${Math.round(clamp(c.alpha, 0, 1) * 1000) / 1000})`);

  const toLinear = (v: number) => (Math.abs(v) <= 0.04045 ? v / 12.92 : Math.sign(v) * Math.pow((Math.abs(v) + 0.055) / 1.055, 2.4));
  const toGamma = (v: number) => (Math.abs(v) > 0.0031308 ? Math.sign(v) * (1.055 * Math.pow(Math.abs(v), 1 / 2.4) - 0.055) : v * 12.92);

  const rgbToOklch = (c: Rgba) => {
    const r = toLinear(c.r);
    const g = toLinear(c.g);
    const b = toLinear(c.b);
    const l = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
    const m = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
    const s = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
    const L = 0.210454268309314 * l + 0.7936177747023054 * m - 0.0040720430116193 * s;
    const A = 1.9779985324311684 * l - 2.42859224204858 * m + 0.450593709617411 * s;
    const B = 0.0259040424655478 * l + 0.7827717124575296 * m - 0.8086757549230774 * s;
    const C = Math.sqrt(A * A + B * B);
    const h = C < 1e-10 ? NaN : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    return { l: L, c: C, h, alpha: c.alpha };
  };

  const oklchToLinear = (L: number, C: number, h: number) => {
    const hr = ((Number.isFinite(h) ? h : 0) * Math.PI) / 180;
    const A = C * Math.cos(hr);
    const B = C * Math.sin(hr);
    const l = Math.pow(L + 0.3963377773761749 * A + 0.2158037573099136 * B, 3);
    const m = Math.pow(L - 0.1055613458156586 * A - 0.0638541728258133 * B, 3);
    const s = Math.pow(L - 0.0894841775298119 * A - 1.2914855480194092 * B, 3);
    return [4.076741636075957 * l - 3.3077115392580616 * m + 0.2309699031821044 * s, -1.2684379732850317 * l + 2.6097573492876887 * m - 0.3413193760026573 * s, -0.0041960761386756 * l - 0.7034186179359363 * m + 1.7076146940746117 * s];
  };

  const GAMUT = 1e-5;
  const inGamut = (rgb: number[]) => rgb.every((v) => v >= -GAMUT && v <= 1 + GAMUT);

  const oklchToRgb = (L: number, C: number, h: number, alpha = 1): Rgba => {
    let chroma = C;
    if (!inGamut(oklchToLinear(L, chroma, h))) {
      let lo = 0;
      let hi = chroma;
      while (hi - lo > 1e-5) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchToLinear(L, mid, h))) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      chroma = lo;
    }
    const [r, g, b] = oklchToLinear(L, chroma, h).map((v) => clamp(toGamma(v), 0, 1));
    return { r, g, b, alpha };
  };

  const hueMix = (a: number, b: number, t: number) => {
    if (!Number.isFinite(a) && !Number.isFinite(b)) {
      return NaN;
    }
    if (!Number.isFinite(a)) {
      return b;
    }
    if (!Number.isFinite(b)) {
      return a;
    }
    let d = b - a;
    if (d > 180) {
      d -= 360;
    } else if (d < -180) {
      d += 360;
    }
    return a + d * t;
  };

  const mixOklch = (a: string, b: string, t: number) => {
    const x = rgbToOklch(parseColor(a));
    const y = rgbToOklch(parseColor(b));
    const mix = (p: number, q: number) => p + (q - p) * t;
    return toCss(oklchToRgb(mix(x.l, y.l), mix(x.c, y.c), hueMix(x.h, y.h, t), mix(x.alpha, y.alpha)));
  };

  const withAlpha = (color: string, alpha: number) => toCss({ ...parseColor(color), alpha });

  const rgbToOklchColor = (c: Rgba) => {
    const o = rgbToOklch(c);
    return { mode: 'oklch', l: o.l, c: o.c, h: Number.isFinite(o.h) ? o.h : 0 };
  };

  const interpolateColors = (input: number, inRange: readonly number[], colors: readonly string[]) => {
    const parts = colors.map(parseColor);
    const pick = (k: keyof Rgba) => interpolate(input, inRange, parts.map((p) => p[k]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const r = Math.round(pick('r') * 255);
    const g = Math.round(pick('g') * 255);
    const b = Math.round(pick('b') * 255);
    const alpha = pick('alpha');
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const light: Theme = {
    background: '#faf9f6',
    foreground: '#141414',
    card: '#ffffff',
    cardForeground: '#141414',
    popover: '#ffffff',
    popoverForeground: '#141414',
    primary: '#3072db',
    primaryForeground: '#ffffff',
    secondary: '#f2f0eb',
    secondaryForeground: '#141414',
    muted: '#f2f0eb',
    mutedForeground: '#6e6a63',
    accent: '#f2f0eb',
    accentForeground: '#141414',
    destructive: '#d92d20',
    destructiveForeground: '#ffffff',
    border: '#d9d9d9',
    input: '#d9d9d9',
    ring: '#3072db',
    radius: 10
  };

  const dark: Theme = {
    background: '#0a0a0b',
    foreground: '#fafafa',
    card: '#141417',
    cardForeground: '#fafafa',
    popover: '#141417',
    popoverForeground: '#fafafa',
    primary: '#3072db',
    primaryForeground: '#ffffff',
    secondary: '#1d1d21',
    secondaryForeground: '#fafafa',
    muted: '#1b1b1f',
    mutedForeground: '#a1a1aa',
    accent: '#1d1d21',
    accentForeground: '#fafafa',
    destructive: '#f97066',
    destructiveForeground: '#fafafa',
    border: '#26272b',
    input: '#26272b',
    ring: '#3072db',
    radius: 10
  };

  const themeOf = (mode: string | undefined, override: Partial<Theme> = {}): Theme => ({ ...(mode === 'dark' ? dark : light), ...override }) as Theme;

  const easings = {
    linear: (t: number) => t,
    out: (t: number) => 1 - (1 - t) ** 3,
    in: (t: number) => t * t * t,
    inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  };

  const springs = {
    snappy: { damping: 18, stiffness: 220, mass: 0.7 },
    soft: { damping: 14, stiffness: 120, mass: 0.9 },
    bouncy: { damping: 10, stiffness: 180, mass: 0.8 }
  };

  const clamp01 = (t: number) => clamp(t, 0, 1);

  const stateTransition = (frame: number, steps: readonly Step[], fallback: string, speed = 1, defaultDuration = 8) => {
    const at = frame * speed;
    const started = steps
      .map((step, index) => ({ step, index }))
      .sort((x, y) => x.step.at - y.step.at || x.index - y.index)
      .filter((e) => e.step.at <= at)
      .filter((e, i, all) => i === all.length - 1 || all[i + 1].step.at !== e.step.at);
    if (!started.length) {
      return { from: fallback, to: fallback, progress: 1 };
    }
    const to = started[started.length - 1].step;
    const from = started.length >= 2 ? started[started.length - 2].step : null;
    const len = to.duration ?? defaultDuration;
    return { from: from ? from.state : fallback, to: to.state, progress: len > 0 ? clamp01((at - to.at) / len) : 1 };
  };

  const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow', 'flexShrink', 'order', 'zoom', 'scale', 'fillOpacity', 'strokeOpacity', 'stopOpacity', 'strokeMiterlimit', 'gridRow', 'gridColumn', 'gridRowStart', 'gridRowEnd', 'gridColumnStart', 'gridColumnEnd', 'columnCount', 'aspectRatio', 'tabSize', 'orphans', 'widows', 'lineClamp', 'WebkitLineClamp', 'animationIterationCount', 'fontSizeAdjust']);

  const kebab = (k: string) => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, '-$1-'));

  const css = (style: Style) =>
    Object.entries(style)
      .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
      .map(([k, v]) => `${kebab(k)}:${typeof v === 'number' && v !== 0 && !UNITLESS.has(k) && !k.startsWith('--') ? `${v}px` : v}`)
      .join(';');

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'filter', 'feGaussianBlur', 'feColorMatrix', 'feOffset', 'feMerge', 'feMergeNode', 'feBlend', 'feTurbulence', 'feDisplacementMap', 'feComposite', 'feFlood', 'text', 'tspan', 'use', 'symbol', 'pattern', 'image', 'foreignObject']);
  const ATTR: Record<string, string> = { className: 'class', htmlFor: 'for', strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeDasharray: 'stroke-dasharray', strokeDashoffset: 'stroke-dashoffset', strokeOpacity: 'stroke-opacity', strokeMiterlimit: 'stroke-miterlimit', fillOpacity: 'fill-opacity', fillRule: 'fill-rule', clipRule: 'clip-rule', clipPath: 'clip-path', stopColor: 'stop-color', stopOpacity: 'stop-opacity', textAnchor: 'text-anchor', dominantBaseline: 'dominant-baseline', fontSize: 'font-size', fontWeight: 'font-weight', fontFamily: 'font-family', xlinkHref: 'href', colorInterpolationFilters: 'color-interpolation-filters', stdDeviation: 'stdDeviation', viewBox: 'viewBox', preserveAspectRatio: 'preserveAspectRatio', gradientUnits: 'gradientUnits', gradientTransform: 'gradientTransform', patternUnits: 'patternUnits', maskUnits: 'maskUnits', filterUnits: 'filterUnits', vectorEffect: 'vector-effect', paintOrder: 'paint-order', letterSpacing: 'letter-spacing' };

  const append = (host: Node, child: Child) => {
    if (child === null || child === undefined || child === false) {
      return;
    }
    if (Array.isArray(child)) {
      child.forEach((c) => append(host, c));
      return;
    }
    host.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  };

  const CROSS_ORIGIN_TAGS = new Set(['img', 'video']);

  const h = (tag: string, attrs: Attrs | null = null, ...children: Child[]): Element => {
    const svg = SVG_TAGS.has(tag);
    const node = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (CROSS_ORIGIN_TAGS.has(tag)) {
      node.setAttribute('crossorigin', 'anonymous');
    }

    for (const [key, value] of Object.entries(attrs ?? {})) {
      if (value === undefined || value === null || value === false) {
        continue;
      }
      if (key === 'style') {
        node.setAttribute('style', css(value as Style));
        continue;
      }
      if (key === 'ref') {
        (value as (n: Element) => void)(node);
        continue;
      }
      if (key === 'text') {
        node.textContent = String(value);
        continue;
      }
      node.setAttribute(ATTR[key] ?? (svg ? key : kebab(key)), value === true ? '' : String(value));
    }
    children.forEach((c) => append(node, c));
    return node;
  };

  const fill = (style: Style = {}, ...children: Child[]) => h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', ...style } }, ...children);

  const THEME_VALUE = new Set(['', 'transparent', 'sans']);

  const BUILTIN_SANS = /^['"]?DM Sans['"]?, system-ui, sans-serif$/;

  const pick = <T>(value: unknown, fallback: T): T => (value === undefined || value === null || THEME_VALUE.has(String(value)) || BUILTIN_SANS.test(String(value)) ? fallback : (value as T));

  const media = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String((item as { src?: unknown })?.src ?? '')).filter(Boolean) : []);

  const CLIP_FILE = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i;

  const videoOf = (value: unknown) => {
    const picked = new Set(Array.isArray(value) ? value.filter((item) => (item as { kind?: unknown })?.kind === 'video').map((item) => String((item as { src?: unknown }).src)) : []);
    return (src: string) => picked.has(src) || CLIP_FILE.test(src);
  };

  const mark = { width: 100, height: 49.05, d: 'M50.2 49.1 52.5 48.9 54.9 48.6 56.8 48.2 58.3 47.7 59.8 47.0 61.6 46.1 63.1 45.1 64.2 44.2 64.3 44.2 64.5 44.0 64.6 44.0 66.4 42.2 66.4 42.1 66.9 41.7 66.9 41.6 67.7 40.8 68.9 38.9 69.7 37.5 69.8 37.5 70.6 35.8 71.5 33.5 72.0 31.4 72.1 30.0 71.9 29.8 65.4 29.9 65.3 30.1 65.1 31.2 64.7 32.7 63.6 35.1 62.1 37.3 60.1 39.2 60.0 39.2 59.2 39.9 57.6 40.9 55.1 41.9 52.6 42.5 49.8 42.6 46.7 42.3 44.2 41.7 41.9 40.6 39.9 39.3 37.9 37.3 37.9 37.2 37.2 36.3 36.2 34.7 35.5 33.1 35.0 31.8 34.6 29.9 28.1 29.8 27.9 30.0 27.9 30.6 28.2 32.2 28.9 34.6 29.6 36.3 30.6 38.1 31.8 40.1 32.8 41.2 32.8 41.3 33.1 41.6 33.1 41.7 34.9 43.5 35.0 43.5 35.7 44.2 35.8 44.2 36.9 45.1 38.9 46.4 40.7 47.3 42.8 48.0 44.6 48.5 46.5 48.8Z M99.8 26.8 100.0 26.6 100.0 24.6 99.8 24.5 92.2 24.5 87.3 24.2 84.6 23.9 83.2 23.5 81.6 23.0 79.6 22.1 77.8 20.9 76.2 19.3 74.3 16.6 74.2 16.4 73.9 16.0 73.9 15.8 72.1 13.1 71.9 13.0 71.7 12.5 70.7 11.2 70.0 10.4 70.0 10.3 68.5 8.7 68.5 8.6 66.6 6.8 66.5 6.8 66.1 6.3 66.0 6.3 64.8 5.2 63.6 4.4 63.5 4.2 61.5 3.0 60.1 2.2 58.2 1.5 55.0 0.5 51.8 0.1 48.2 0.1 45.6 0.4 43.5 0.9 41.8 1.5 39.9 2.2 38.2 3.2 36.1 4.5 34.7 5.6 34.6 5.6 34.4 5.9 34.3 5.9 33.5 6.8 33.4 6.8 30.6 9.7 30.6 9.8 29.3 11.2 28.3 12.5 28.1 13.0 27.9 13.1 26.1 15.8 26.1 16.0 25.8 16.4 25.7 16.6 25.3 17.2 25.2 17.4 24.2 18.8 22.7 20.5 22.6 20.5 22.2 20.9 21.6 21.4 20.5 22.1 18.4 23.0 15.9 23.7 14.1 24.1 11.6 24.4 7.8 24.5 0.2 24.5 0.0 24.6 0.0 26.6 0.2 26.8Z M62.2 24.0 37.8 24.0 36.9 23.8 35.8 23.3 34.8 22.4 34.4 21.7 34.2 21.1 34.2 19.3 34.7 17.3 35.6 15.4 36.4 14.3 36.7 14.1 36.7 14.0 38.5 12.2 40.1 11.2 40.6 10.9 41.0 10.6 42.8 9.7 45.3 8.9 47.2 8.4 48.5 8.3 50.8 8.2 52.8 8.4 55.3 9.1 57.7 9.9 59.9 11.2 62.1 12.8 63.8 14.6 64.4 15.4 65.1 16.7 65.7 18.7 65.8 19.3 65.8 20.8 65.6 21.7 65.3 22.2 65.0 22.6 64.2 23.3 63.1 23.8Z' };

  return { media, videoOf, mark, pick, clamp, interpolate, spring, measureSpring, Easing, random, parseColor, toCss, rgbToOklch: rgbToOklchColor, oklchToRgb: (l: number, c: number, hue: number) => toCss(oklchToRgb(l, c, hue)), mixOklch, withAlpha, interpolateColors, light, dark, themeOf, easings, springs, clamp01, stateTransition, css, h, fill };
}

export type SnapcnKit = ReturnType<typeof snapcnKit>;
